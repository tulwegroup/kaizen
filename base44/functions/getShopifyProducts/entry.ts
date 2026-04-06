import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'POST only' }, { status: 405 });

  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const sessions = await base44.asServiceRole.entities.ShopifySession.list();
  if (!sessions.length) return Response.json({ error: 'No Shopify session' }, { status: 400 });
  const { shop_domain, access_token } = sessions[0];

  // Paginate through all products (250 per page max)
  let allProducts = [];
  let pageInfo = null;

  while (true) {
    let url = `https://${shop_domain}/admin/api/2024-01/products.json?limit=250&fields=id,title,status,product_type,vendor,tags,variants,images,created_at,updated_at`;
    if (pageInfo) url += `&page_info=${pageInfo}`;

    const res = await fetch(url, {
      headers: { 'X-Shopify-Access-Token': access_token }
    });
    const data = await res.json();
    if (!data.products) break;
    allProducts = allProducts.concat(data.products);

    // Check for next page via Link header
    const linkHeader = res.headers.get('Link') || '';
    const nextMatch = linkHeader.match(/<[^>]*page_info=([^&>]+)[^>]*>;\s*rel="next"/);
    if (nextMatch) {
      pageInfo = nextMatch[1];
    } else {
      break;
    }
  }

  // Normalize to a common shape
  const products = allProducts.map(p => {
    const variant = p.variants?.[0] || {};
    const price = parseFloat(variant.price || 0);
    const compareAt = parseFloat(variant.compare_at_price || 0);
    const tags = (p.tags || '').split(',').map(t => t.trim()).filter(Boolean);

    // Infer source from tags or vendor
    let best_source = 'shopify';
    const tagStr = p.tags.toLowerCase();
    const vendor = (p.vendor || '').toLowerCase();
    if (tagStr.includes('aliexpress') || vendor.includes('aliexpress')) best_source = 'aliexpress';
    else if (tagStr.includes('alibaba') || vendor.includes('alibaba')) best_source = 'alibaba';
    else if (tagStr.includes('temu') || vendor.includes('temu')) best_source = 'temu';
    else if (tagStr.includes('cj') || vendor.includes('cj')) best_source = 'cj';
    else if (p.product_type?.toLowerCase().includes('digital') || tagStr.includes('digital')) best_source = 'digital';

    return {
      shopify_id: p.id,
      product_name: p.title,
      product_type: p.product_type?.toLowerCase().includes('digital') ? 'digital' : 'physical',
      vendor: p.vendor,
      status: p.status,
      best_source,
      recommended_sell_price: price,
      compare_at_price: compareAt,
      gross_margin_pct: compareAt > 0 ? Math.round(((price - compareAt * 0.4) / price) * 100) : null,
      estimated_cogs: compareAt > 0 ? Math.round(compareAt * 0.4 * 100) / 100 : null,
      tags,
      niche: p.product_type || 'general',
      image_url: p.images?.[0]?.src || null,
      created_at: p.created_at,
      updated_at: p.updated_at,
      variants_count: p.variants?.length || 1,
      _source: 'shopify',
    };
  });

  return Response.json({ success: true, products, total: products.length });
});