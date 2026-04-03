/**
 * automatedPipeline
 * Full end-to-end automation (all logic inlined — no function-to-function calls):
 *   1. Run AI market research
 *   2. Import top products to Shopify as drafts
 *   3. Match products to existing influencers and generate outreach campaigns
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function shopifyRequest(domain, token, method, path, body) {
  const res = await fetch(`https://${domain}/admin/api/2026-01/${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Shopify [${res.status}] ${JSON.stringify(data)}`);
  return data;
}

async function fetchImageAsBase64(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'image/*', 'Referer': 'https://www.google.com/' },
      redirect: 'follow',
    });
    if (!res.ok || !res.headers.get('content-type')?.startsWith('image/')) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  } catch { return null; }
}

// ── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'POST only' }, { status: 405 });

  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user || user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

  const { regions, niches, period = '1month', max_products = 5, max_influencers_per_product = 3 } = await req.json();
  if (!regions?.length) return Response.json({ error: 'regions required' }, { status: 400 });

  const log = [];
  const addLog = (step, status, message, data = null) => { log.push({ step, status, message, data, ts: new Date().toISOString() }); };

  // ─── STEP 1: Research ─────────────────────────────────────────────────────
  addLog('research', 'running', `Researching products in ${regions.join(', ')}…`);

  const PERIOD_LABELS = { '24h': '24 Hours', '1week': '1 Week', '1month': '1 Month', '3month': '3 Months', '6month': '6 Months', '1year': '1 Year' };
  const PERIOD_MULTIPLIERS = { '24h': 1/30, '1week': 7/30, '1month': 1, '3month': 3, '6month': 6, '1year': 12 };
  const periodMultiplier = PERIOD_MULTIPLIERS[period] || 1;
  const nichesStr = niches?.length ? niches.join(', ') : 'fashion, beauty, lifestyle, tech, fitness, home';

  const productResearch = await base44.integrations.Core.InvokeLLM({
    prompt: `You are a dropshipping market research agent. Research the current top trending consumer products in these regions: ${regions.join(', ')}.
Focus on these niches: ${nichesStr}.
For each region, identify 3-5 winning products trending now with strong dropshipping margins, suitable for influencer marketing.
For each product provide: product_name, niche (one of: fashion/beauty/lifestyle/tech/fitness/home), region, estimated_cogs (USD), recommended_sell_price (USD), gross_margin_pct, search_trend ("rising"|"peak"|"stable"), why_it_works (1-2 sentences), cj_search_keywords (2-3 keywords array), target_audience, top_platforms (array), image_url (direct CDN URL ending .jpg/.jpeg/.png/.webp — use Unsplash or Pexels only).`,
    add_context_from_internet: true,
    model: 'gemini_3_flash',
    response_json_schema: {
      type: 'object',
      properties: {
        products: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              product_name: { type: 'string' }, niche: { type: 'string' }, region: { type: 'string' },
              estimated_cogs: { type: 'number' }, recommended_sell_price: { type: 'number' },
              gross_margin_pct: { type: 'number' }, search_trend: { type: 'string' },
              why_it_works: { type: 'string' }, cj_search_keywords: { type: 'array', items: { type: 'string' } },
              target_audience: { type: 'string' }, top_platforms: { type: 'array', items: { type: 'string' } },
              image_url: { type: 'string' },
            }
          }
        },
        market_summary: { type: 'string' }
      }
    }
  });

  const allProducts = productResearch.products || [];
  const products = allProducts.sort((a, b) => b.gross_margin_pct - a.gross_margin_pct).slice(0, max_products);
  addLog('research', 'done', `Found ${allProducts.length} products — using top ${products.length}`, { market_summary: productResearch.market_summary, selected: products.map(p => p.product_name) });

  // ─── STEP 2: Import to Shopify ────────────────────────────────────────────
  const shopDomain = Deno.env.get('SHOPIFY_STORE_DOMAIN');
  if (!shopDomain) { addLog('shopify', 'failed', 'SHOPIFY_STORE_DOMAIN not set'); return Response.json({ success: false, log }); }

  const sessions = await base44.asServiceRole.entities.ShopifySession.filter({ shop_domain: shopDomain });
  const shopToken = sessions[0]?.access_token;
  if (!shopToken) { addLog('shopify', 'failed', 'No Shopify session — complete OAuth first'); return Response.json({ success: false, log }); }

  // Get location for inventory (optional)
  let locationId = null;
  try {
    const locData = await shopifyRequest(shopDomain, shopToken, 'GET', 'locations.json');
    locationId = locData.locations?.[0]?.id;
  } catch { /* scope not granted — skip inventory */ }

  const imported = [];
  for (const product of products) {
    addLog('shopify', 'running', `Importing "${product.product_name}"…`);
    try {
      // Enrich with LLM
      const enriched = await base44.integrations.Core.InvokeLLM({
        prompt: `Product listing specialist. Research "${product.product_name}" (niche: ${product.niche}).
Return: image_urls (5 Unsplash/Pexels direct CDN URLs only), body_html (SEO HTML 3-4 paragraphs), meta_title (60 chars), meta_description (155 chars), tags (8-10 array), product_type.`,
        add_context_from_internet: true,
        model: 'gemini_3_flash',
        response_json_schema: {
          type: 'object',
          properties: {
            image_urls: { type: 'array', items: { type: 'string' } },
            body_html: { type: 'string' },
            meta_title: { type: 'string' },
            meta_description: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' } },
            product_type: { type: 'string' },
          }
        }
      });

      const allTags = [...(enriched.tags || []), product.niche, product.search_trend, 'research-agent', product.region].filter(Boolean);
      const created = await shopifyRequest(shopDomain, shopToken, 'POST', 'products.json', {
        product: {
          title: product.product_name,
          body_html: enriched.body_html || `<p>${product.why_it_works || ''}</p>`,
          vendor: 'Research Agent',
          product_type: enriched.product_type || product.niche || 'dropship',
          status: 'draft',
          tags: allTags.join(', '),
          variants: [{
            price: String(product.recommended_sell_price || '0.00'),
            compare_at_price: product.recommended_sell_price ? String(Math.round(product.recommended_sell_price * 1.4 * 100) / 100) : null,
            sku: `RA-${product.product_name.replace(/\s+/g, '-').toUpperCase().substring(0, 20)}-${Date.now()}`,
            inventory_management: 'shopify',
            inventory_policy: 'deny',
          }],
        },
      });

      const pid = created.product.id;
      const inventoryItemId = created.product.variants?.[0]?.inventory_item_id;
      if (locationId && inventoryItemId) {
        await shopifyRequest(shopDomain, shopToken, 'POST', 'inventory_levels/set.json', { location_id: locationId, inventory_item_id: inventoryItemId, available: 999 });
      }

      // Upload images
      let imagesImported = 0;
      for (let i = 0; i < (enriched.image_urls || []).length; i++) {
        const attachment = await fetchImageAsBase64(enriched.image_urls[i]);
        if (!attachment) continue;
        try {
          await shopifyRequest(shopDomain, shopToken, 'POST', `products/${pid}/images.json`, { image: { attachment, position: i + 1 } });
          imagesImported++;
        } catch { /* skip */ }
      }

      const shopifyInfo = { shopify_product_id: String(pid), shopify_admin_url: `https://${shopDomain}/admin/products/${pid}`, images_imported: imagesImported };
      imported.push({ product, shopify: shopifyInfo });
      addLog('shopify', 'done', `✓ Imported "${product.product_name}" (${imagesImported} images)`, shopifyInfo);
    } catch (e) {
      addLog('shopify', 'failed', `✗ Failed "${product.product_name}": ${e.message}`);
    }
  }

  // ─── STEP 3: Influencer Outreach ──────────────────────────────────────────
  const influencers = await base44.asServiceRole.entities.InfluencerProfile.list();
  const eligible = influencers.filter(inf => ['discovered', 'contacted'].includes(inf.status));

  if (!eligible.length) {
    addLog('outreach', 'skipped', 'No eligible influencers found. Add influencers in the CRM first.');
    return Response.json({
      success: true,
      summary: { products_researched: allProducts.length, products_imported: imported.length, campaigns_created: 0, influencers_contacted: 0 },
      log, campaigns: [],
    });
  }

  addLog('outreach', 'running', `Found ${eligible.length} eligible influencers — creating campaigns…`);
  const campaigns = [];

  for (const { product, shopify } of imported) {
    const matched = eligible.filter(inf => inf.niche === product.niche).slice(0, max_influencers_per_product);
    const targets = matched.length ? matched : eligible.slice(0, max_influencers_per_product);

    for (const influencer of targets) {
      if (!influencer.discount_code) {
        const code = `${influencer.platform_username.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 8)}${Math.floor(Math.random() * 900 + 100)}`;
        await base44.asServiceRole.entities.InfluencerProfile.update(influencer.id, { discount_code: code });
        influencer.discount_code = code;
      }

      const message = `Hi @${influencer.platform_username}! 👋\n\nWe think "${product.product_name}" would be a perfect fit for your audience. We'd love to send you a free sample and offer your followers an exclusive discount code (${influencer.discount_code}).\n\nNo upfront fees — share your honest review and earn 15% commission on every sale!\n\nInterested? Reply and we'll send details right away. 🙌`;

      const campaign = await base44.asServiceRole.entities.InfluencerCampaign.create({
        campaign_name: `${product.product_name} × @${influencer.platform_username}`,
        influencer_id: influencer.id,
        status: 'outreach_sent',
        discount_code: influencer.discount_code,
        commission_rate: 15,
        commission_type: 'percentage',
        message_sent: message,
        metadata: { product_name: product.product_name, shopify_admin_url: shopify.shopify_admin_url, outreach_date: new Date().toISOString(), platform: influencer.platform, niche: product.niche, region: product.region },
      });

      await base44.asServiceRole.entities.InfluencerProfile.update(influencer.id, { status: 'contacted' });
      campaigns.push({ influencer: influencer.platform_username, product: product.product_name, campaign_id: campaign.id });
      addLog('outreach', 'done', `✓ Campaign: "${product.product_name}" → @${influencer.platform_username}`);
    }
  }

  addLog('outreach', 'complete', `${campaigns.length} campaign(s) created`);

  return Response.json({
    success: true,
    summary: {
      products_researched: allProducts.length,
      products_imported: imported.length,
      campaigns_created: campaigns.length,
      influencers_contacted: [...new Set(campaigns.map(c => c.influencer))].length,
    },
    log, campaigns,
  });
});