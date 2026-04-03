/**
 * automatedPipeline
 * Full end-to-end automation:
 *   1. Run AI market research
 *   2. Import top products to Shopify as drafts
 *   3. Match products to existing influencers and generate outreach campaigns
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'POST only' }, { status: 405 });

  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user || user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

  const { regions, niches, period = '1month', max_products = 5, max_influencers_per_product = 3 } = await req.json();

  if (!regions?.length) return Response.json({ error: 'regions required' }, { status: 400 });

  const log = [];
  const addLog = (step, status, message, data = null) => {
    const entry = { step, status, message, data, ts: new Date().toISOString() };
    log.push(entry);
    return entry;
  };

  // ─── STEP 1: Research ────────────────────────────────────────────────────────
  addLog('research', 'running', `Researching products in ${regions.join(', ')}…`);

  const researchRes = await base44.asServiceRole.functions.invoke('agentResearch', {
    regions, niches, period,
  });

  if (researchRes?.status !== 'success') {
    addLog('research', 'failed', researchRes?.error || 'Research failed');
    return Response.json({ success: false, log });
  }

  const allProducts = researchRes.products || [];
  // Take top N by gross_margin_pct
  const products = allProducts
    .sort((a, b) => b.gross_margin_pct - a.gross_margin_pct)
    .slice(0, max_products);

  addLog('research', 'done', `Found ${allProducts.length} products — importing top ${products.length}`, {
    total_found: allProducts.length,
    selected: products.map(p => p.product_name),
    market_summary: researchRes.market_summary,
    profit_projections: researchRes.profit_projections,
  });

  // ─── STEP 2: Import to Shopify ───────────────────────────────────────────────
  const imported = [];
  for (const product of products) {
    addLog('shopify', 'running', `Importing "${product.product_name}" to Shopify…`);
    const importRes = await base44.asServiceRole.functions.invoke('importResearchProduct', { product });
    if (importRes?.success) {
      imported.push({ product, shopify: importRes });
      addLog('shopify', 'done', `✓ Imported "${product.product_name}"`, importRes);
    } else {
      addLog('shopify', 'failed', `✗ Failed to import "${product.product_name}": ${importRes?.error || 'unknown'}`);
    }
  }

  // ─── STEP 3: Influencer Outreach ─────────────────────────────────────────────
  const influencers = await base44.asServiceRole.entities.InfluencerProfile.list();
  const eligibleInfluencers = influencers.filter(inf =>
    ['discovered', 'contacted'].includes(inf.status)
  );

  if (eligibleInfluencers.length === 0) {
    addLog('outreach', 'skipped', 'No eligible influencers found. Add influencers in the CRM first.');
    return Response.json({ success: true, log, imported_count: imported.length, outreach_count: 0 });
  }

  addLog('outreach', 'running', `Found ${eligibleInfluencers.length} eligible influencers — creating campaigns…`);

  const campaigns = [];
  for (const { product, shopify } of imported) {
    // Pick influencers whose niche matches the product, or any if no match
    const matched = eligibleInfluencers
      .filter(inf => inf.niche === product.niche || !inf.niche)
      .slice(0, max_influencers_per_product);

    const targets = matched.length > 0 ? matched : eligibleInfluencers.slice(0, max_influencers_per_product);

    for (const influencer of targets) {
      // Generate discount code if not already set
      if (!influencer.discount_code) {
        const code = `${influencer.platform_username.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 8)}${Math.floor(Math.random() * 900 + 100)}`;
        await base44.asServiceRole.entities.InfluencerProfile.update(influencer.id, {
          discount_code: code,
          status: influencer.status === 'discovered' ? 'contacted' : influencer.status,
        });
        influencer.discount_code = code;
      }

      // Build outreach message
      const message = `Hi @${influencer.platform_username}! 👋

We think "${product.product_name}" would be a perfect fit for your audience. We'd love to send you a free sample and offer you an exclusive ${influencer.discount_code ? `15% discount code (${influencer.discount_code})` : 'discount code'} for your followers.

No upfront fees — just share your honest review and earn 15% commission on every sale through your link!

Interested? Reply and we'll send details right away. 🙌`;

      // Create campaign record
      const campaign = await base44.asServiceRole.entities.InfluencerCampaign.create({
        campaign_name: `${product.product_name} × @${influencer.platform_username}`,
        influencer_id: influencer.id,
        status: 'outreach_sent',
        discount_code: influencer.discount_code,
        commission_rate: 15,
        commission_type: 'percentage',
        message_sent: message,
        metadata: {
          product_name: product.product_name,
          shopify_product_id: shopify.shopify_product_id,
          shopify_admin_url: shopify.shopify_admin_url,
          outreach_date: new Date().toISOString(),
          platform: influencer.platform,
          niche: product.niche,
          region: product.region,
        },
      });

      campaigns.push({ influencer: influencer.platform_username, product: product.product_name, campaign_id: campaign.id });
      addLog('outreach', 'done', `✓ Campaign created: "${product.product_name}" → @${influencer.platform_username}`);

      // Update influencer status to contacted
      await base44.asServiceRole.entities.InfluencerProfile.update(influencer.id, { status: 'contacted' });
    }
  }

  addLog('outreach', 'complete', `${campaigns.length} campaign(s) created across ${imported.length} product(s)`);

  return Response.json({
    success: true,
    summary: {
      products_researched: allProducts.length,
      products_imported: imported.length,
      campaigns_created: campaigns.length,
      influencers_contacted: [...new Set(campaigns.map(c => c.influencer))].length,
    },
    log,
    campaigns,
  });
});