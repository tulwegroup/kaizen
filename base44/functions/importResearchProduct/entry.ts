/**
 * importResearchProduct
 * Enriches a research-agent product with real images + rich HTML description via LLM,
 * then creates it as a Shopify draft product with inventory and images.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

async function fetchImageAsBase64(url) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
        'Referer': 'https://www.google.com/',
      },
      redirect: 'follow',
    });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) return null;
    const buffer = await res.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  } catch {
    return null;
  }
}

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

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'POST only' }, { status: 405 });

  const base44 = createClientFromRequest(req);

  const { product } = await req.json();
  if (!product?.product_name) return Response.json({ error: 'product.product_name required' }, { status: 400 });

  const shopDomain = Deno.env.get('SHOPIFY_STORE_DOMAIN');
  if (!shopDomain) return Response.json({ error: 'SHOPIFY_STORE_DOMAIN not set' }, { status: 500 });

  // Duplicate check — search Shopify for existing product with same title
  const sessions = await base44.asServiceRole.entities.ShopifySession.filter({ shop_domain: shopDomain });
  const token = sessions[0]?.access_token;
  if (!token) return Response.json({ error: 'No Shopify session. Complete OAuth first.' }, { status: 401 });

  const searchRes = await shopifyRequest(shopDomain, token, 'GET', `products.json?title=${encodeURIComponent(product.product_name)}&fields=id,title,handle&limit=5`);
  const existing = (searchRes.products || []).find(
    p => p.title.toLowerCase().trim() === product.product_name.toLowerCase().trim()
  );
  if (existing) {
    return Response.json({
      success: true,
      already_exists: true,
      shopify_product_id: String(existing.id),
      shopify_handle: existing.handle,
      shopify_admin_url: `https://${shopDomain}/admin/products/${existing.id}`,
      title: existing.title,
      message: 'Product already exists in Shopify — skipped duplicate.',
    });
  }

  // Phase 1: Enrich via LLM + internet
  const enriched = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt: `You are a product listing specialist for a dropshipping store.

Research the product "${product.product_name}" (niche: ${product.niche}, region: ${product.region || 'global'}).

Return:
1. image_urls: 5 direct product image URLs. Use only CDN sources that allow hotlinking:
   - Unsplash (https://images.unsplash.com/photo-...)
   - Pexels CDN (https://images.pexels.com/photos/...)
   - Wikimedia (https://upload.wikimedia.org/...)
   - Direct .jpg/.png/.webp from manufacturer/brand sites
   DO NOT use Amazon, AliExpress, eBay or any marketplace.
2. body_html: SEO-optimized HTML product description (3-4 paragraphs) using <p>, <ul>, <li>, <strong>. Include: what it is, key benefits, who it's for.
3. meta_title: SEO title, 60 chars max
4. meta_description: 155 chars max
5. tags: 8-10 relevant tags as array
6. product_type: most accurate category name

Context:
- Why it works: ${product.why_it_works || ''}
- Target audience: ${product.target_audience || ''}
- Platforms: ${(product.top_platforms || []).join(', ')}
- Sell price: $${product.recommended_sell_price}
- COGS: $${product.estimated_cogs}`,
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

  // Phase 2: Get the primary Shopify location (needed for inventory) — skip if scope missing
  let locationId = null;
  try {
    const locationsData = await shopifyRequest(shopDomain, token, 'GET', 'locations.json');
    locationId = locationsData.locations?.[0]?.id;
  } catch {
    // read_locations scope not granted — inventory will be skipped
  }

  // Phase 3: Create Shopify product
  const allTags = [...(enriched.tags || []), product.niche, product.search_trend, 'research-agent', product.region].filter(Boolean);

  const created = await shopifyRequest(shopDomain, token, 'POST', 'products.json', {
    product: {
      title: product.product_name,
      body_html: enriched.body_html || `<p>${product.why_it_works || ''}</p>`,
      vendor: 'Research Agent',
      product_type: enriched.product_type || product.niche || 'dropship',
      status: 'active',
      published_scope: 'web',
      tags: allTags.join(', '),
      metafields_global_title_tag: enriched.meta_title || product.product_name,
      metafields_global_description_tag: enriched.meta_description || '',
      variants: [{
        price: String(product.recommended_sell_price || '0.00'),
        compare_at_price: product.recommended_sell_price
          ? String(Math.round(product.recommended_sell_price * 1.4 * 100) / 100)
          : null,
        sku: `RA-${product.product_name.replace(/\s+/g, '-').toUpperCase().substring(0, 20)}-${Date.now()}`,
        inventory_management: 'shopify',
        inventory_policy: 'deny',
        fulfillment_service: 'manual',
        taxable: true,
      }],
    },
  });

  const shopifyProductId = created.product.id;
  const inventoryItemId = created.product.variants?.[0]?.inventory_item_id;

  // Phase 4: Set inventory quantity (requires location)
  if (locationId && inventoryItemId) {
    await shopifyRequest(shopDomain, token, 'POST', 'inventory_levels/set.json', {
      location_id: locationId,
      inventory_item_id: inventoryItemId,
      available: 999,
    });
  }

  // Phase 5: Upload images as base64 attachments
  const imageUrls = (enriched.image_urls || []).filter(u => u && u.startsWith('http'));
  let imagesImported = 0;
  for (let i = 0; i < imageUrls.length; i++) {
    const attachment = await fetchImageAsBase64(imageUrls[i]);
    if (!attachment) continue;
    try {
      await shopifyRequest(shopDomain, token, 'POST', `products/${shopifyProductId}/images.json`, {
        image: { attachment, alt: `${product.product_name} - Image ${i + 1}`, position: i + 1 },
      });
      imagesImported++;
    } catch { /* skip failed image */ }
  }

  // Save mapping
  await base44.asServiceRole.entities.ShopifyMapping.create({
    entity_type: 'product',
    canonical_id: `research-${shopifyProductId}`,
    shopify_id: String(shopifyProductId),
    shopify_gid: `gid://shopify/Product/${shopifyProductId}`,
    shop_domain: shopDomain,
    sync_status: 'synced',
    last_synced_at: new Date().toISOString(),
    metadata: {
      title: created.product.title,
      handle: created.product.handle,
      source: 'research_agent',
      niche: product.niche,
      region: product.region,
      images_count: imagesImported,
    },
  });

  return Response.json({
    success: true,
    shopify_product_id: String(shopifyProductId),
    shopify_handle: created.product.handle,
    shopify_admin_url: `https://${shopDomain}/admin/products/${shopifyProductId}`,
    title: created.product.title,
    status: created.product.status,
    images_imported: imagesImported,
    inventory_set: locationId && inventoryItemId ? true : false,
  });
});