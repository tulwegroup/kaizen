/**
 * importResearchProduct
 * Enriches a research-agent product with real images + rich HTML description via LLM,
 * then creates it as a Shopify draft product.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'POST only' }, { status: 405 });

  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { product } = await req.json();
  if (!product?.product_name) return Response.json({ error: 'product.product_name required' }, { status: 400 });

  const shopDomain = Deno.env.get('SHOPIFY_STORE_DOMAIN');
  if (!shopDomain) return Response.json({ error: 'SHOPIFY_STORE_DOMAIN not set' }, { status: 500 });

  const sessions = await base44.asServiceRole.entities.ShopifySession.filter({ shop_domain: shopDomain });
  const token = sessions[0]?.access_token;
  if (!token) return Response.json({ error: 'No Shopify session. Complete OAuth first.' }, { status: 401 });

  // Phase 1: Enrich product with real images and a rich description via LLM + internet
  const enriched = await base44.integrations.Core.InvokeLLM({
    prompt: `You are a product listing specialist for a dropshipping store. Research the product "${product.product_name}" (niche: ${product.niche}, target region: ${product.region || 'global'}).

Find and return:
1. 3-5 real, publicly accessible image URLs of this product from e-commerce sites (Amazon, AliExpress, product sites, etc.). These MUST be direct image URLs ending in .jpg, .jpeg, .png, or .webp. Only include URLs you are confident are valid and publicly accessible.
2. A compelling, SEO-optimized HTML product description (3-4 paragraphs) using <p>, <ul>, <li>, <strong> tags. Include: what it is, key benefits, who it's for, why they'll love it.
3. A concise SEO meta title (60 chars max).
4. A meta description for search engines (155 chars max).
5. 8-10 relevant product tags as an array.
6. The most accurate product category/type name.

Product context:
- Why it works: ${product.why_it_works || ''}
- Target audience: ${product.target_audience || ''}
- Top platforms: ${(product.top_platforms || []).join(', ')}
- Sell price: $${product.recommended_sell_price}
- Cost of goods: $${product.estimated_cogs}`,
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

  // Build Shopify product payload
  const allTags = [
    ...(enriched.tags || []),
    product.niche,
    product.search_trend,
    'research-agent',
    product.region,
  ].filter(Boolean);

  const shopifyPayload = {
    product: {
      title: product.product_name,
      body_html: enriched.body_html || `<p>${product.why_it_works || ''}</p>`,
      vendor: 'Research Agent',
      product_type: enriched.product_type || product.niche || 'dropship',
      status: 'draft',
      tags: allTags.join(', '),
      metafields_global_title_tag: enriched.meta_title || product.product_name,
      metafields_global_description_tag: enriched.meta_description || '',
      variants: [
        {
          price: String(product.recommended_sell_price || '0.00'),
          compare_at_price: product.recommended_sell_price
            ? String(Math.round(product.recommended_sell_price * 1.4 * 100) / 100)
            : null,
          cost: product.estimated_cogs ? String(product.estimated_cogs) : null,
          sku: `RA-${product.product_name.replace(/\s+/g, '-').toUpperCase().substring(0, 20)}-${Date.now()}`,
          inventory_management: 'shopify',
          inventory_policy: 'deny',
          fulfillment_service: 'manual',
          weight: 0.5,
          weight_unit: 'kg',
          taxable: true,
        },
      ],
    },
  };

  // Attach images from LLM research
  const imageUrls = (enriched.image_urls || []).filter(u => u && u.startsWith('http'));
  if (imageUrls.length > 0) {
    shopifyPayload.product.images = imageUrls.map((src, i) => ({
      src,
      alt: `${product.product_name} - Image ${i + 1}`,
      position: i + 1,
    }));
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

  // Save ShopifyMapping record
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
      images_count: p.images?.length || 0,
    },
  });

  return Response.json({
    success: true,
    shopify_product_id: String(p.id),
    shopify_handle: p.handle,
    shopify_admin_url: `https://${shopDomain}/admin/products/${p.id}`,
    title: p.title,
    status: p.status,
    images_imported: p.images?.length || 0,
  });
});