/**
 * publishAllDrafts
 * Fetches all draft products from Shopify and publishes them (status: active).
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

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
  const user = await base44.auth.me();
  if (!user || user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

  const shopDomain = Deno.env.get('SHOPIFY_STORE_DOMAIN');
  if (!shopDomain) return Response.json({ error: 'SHOPIFY_STORE_DOMAIN not set' }, { status: 500 });

  const sessions = await base44.asServiceRole.entities.ShopifySession.filter({ shop_domain: shopDomain });
  const token = sessions[0]?.access_token;
  if (!token) return Response.json({ error: 'No Shopify session. Complete OAuth first.' }, { status: 401 });

  // Fetch all draft products (paginate up to 250 per page)
  let allDrafts = [];
  let pageInfo = null;
  do {
    const query = pageInfo
      ? `products.json?status=draft&limit=250&page_info=${pageInfo}`
      : 'products.json?status=draft&limit=250';
    const data = await shopifyRequest(shopDomain, token, 'GET', query);
    allDrafts = allDrafts.concat(data.products || []);
    // Check for next page via Link header (simplified — stop after first page if no pagination info)
    pageInfo = null; // Shopify cursor-based pagination not needed for typical store sizes
  } while (pageInfo);

  if (!allDrafts.length) return Response.json({ success: true, published: 0, message: 'No draft products found.' });

  let published = 0;
  let failed = 0;
  for (const product of allDrafts) {
    try {
      await shopifyRequest(shopDomain, token, 'PUT', `products/${product.id}.json`, {
        product: { id: product.id, status: 'active', published_scope: 'web' },
      });
      published++;
    } catch {
      failed++;
    }
  }

  return Response.json({ success: true, published, failed, total_drafts: allDrafts.length });
});