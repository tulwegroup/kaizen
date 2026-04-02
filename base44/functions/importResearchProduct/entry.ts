/**
 * importResearchProduct
 * Takes a product from the research agent and creates it as a Shopify draft product.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'POST only' }, { status: 405 });

  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { product } = await req.json();
  if (!product?.product_name) return Response.json({ error: 'product.product_name is required' }, { status: 400 });

  const shopDomain = Deno.env.get('SHOPIFY_STORE_DOMAIN');
  if (!shopDomain) return Response.json({ error: 'SHOPIFY_STORE_DOMAIN not set' }, { status: 500 });

  const sessions = await base44.asServiceRole.entities.ShopifySession.filter({ shop_domain: shopDomain });
  const token = sessions[0]?.access_token;
  if (!token) return Response.json({ error: 'No Shopify session. Complete OAuth first.' }, { status: 401 });

  // Build description from research data
  const description = [
    product.why_it_works || '',
    `Niche: ${product.niche || ''}`,
    `Target Region: ${product.region || ''}`,
    `Gross Margin: ${product.gross_margin_pct || ''}%`,
    `Search Trend: ${product.search_trend || ''}`,
  ].filter(Boolean).join('\n');

  const shopifyPayload = {
    product: {
      title: product.product_name,
      body_html: description.replace(/\n/g, '<br>'),
      vendor: 'Research Agent',
      product_type: product.niche || 'dropship',
      status: 'draft',
      tags: [product.niche, product.search_trend, 'research-agent', product.region].filter(Boolean).join(', '),
      variants: [
        {
          price: String(product.recommended_sell_price || '0.00'),
          compare_at_price: product.estimated_cogs
            ? String(Math.round(product.recommended_sell_price * 1.5 * 100) / 100)
            : null,
          sku: `RA-${product.product_name.replace(/\s+/g, '-').toUpperCase().substring(0, 20)}-${Date.now()}`,
          inventory_management: 'shopify',
          inventory_policy: 'deny',
          fulfillment_service: 'manual',
        },
      ],
    },
  };

  // Attach image if provided
  if (product.image_url) {
    shopifyPayload.product.images = [{ src: product.image_url, alt: product.product_name }];
  }

  const shopifyRes = await fetch(`https://${shopDomain}/admin/api/2026-01/products.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
    body: JSON.stringify(shopifyPayload),
  });

  if (!shopifyRes.ok) {
    const errText = await shopifyRes.text();
    return Response.json({ error: `Shopify error [${shopifyRes.status}]: ${errText}` }, { status: 502 });
  }

  const data = await shopifyRes.json();
  const p = data.product;

  // Save a ShopifyMapping record
  await base44.asServiceRole.entities.ShopifyMapping.create({
    entity_type: 'product',
    canonical_id: `research-${p.id}`,
    shopify_id: String(p.id),
    shopify_gid: `gid://shopify/Product/${p.id}`,
    shop_domain: shopDomain,
    sync_status: 'synced',
    last_synced_at: new Date().toISOString(),
    metadata: {
      title: p.title,
      handle: p.handle,
      source: 'research_agent',
      niche: product.niche,
      region: product.region,
    },
  });

  return Response.json({
    success: true,
    shopify_product_id: String(p.id),
    shopify_handle: p.handle,
    shopify_admin_url: `https://${shopDomain}/admin/products/${p.id}`,
    title: p.title,
    status: p.status,
  });
});