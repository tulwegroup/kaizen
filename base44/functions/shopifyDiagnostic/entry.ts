/**
 * shopifyDiagnostic — reads live state from Shopify
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

async function shopify(domain, token, path) {
  const res = await fetch(`https://${domain}/admin/api/2024-01/${path}`, {
    headers: { 'X-Shopify-Access-Token': token },
  });
  return res.json();
}

async function graphql(domain, token, query) {
  const res = await fetch(`https://${domain}/admin/api/2024-01/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
    body: JSON.stringify({ query }),
  });
  return res.json();
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'POST only' }, { status: 405 });

  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const shopDomain = Deno.env.get('SHOPIFY_STORE_DOMAIN');
  const sessions = await base44.asServiceRole.entities.ShopifySession.filter({ shop_domain: shopDomain });
  const token = sessions[0]?.access_token;
  if (!token) return Response.json({ error: 'No session' }, { status: 401 });

  // Check publications
  const pubGql = await graphql(shopDomain, token, `{
    publications(first: 10) { edges { node { id name } } }
  }`);

  // Check products (sample)
  const products = await shopify(shopDomain, token, 'products.json?limit=5&fields=id,title,status,published_at,published_scope');

  // Check product count by status
  const activeCount = await shopify(shopDomain, token, 'products/count.json?status=active');
  const draftCount = await shopify(shopDomain, token, 'products/count.json?status=draft');

  // Check pages
  const pages = await shopify(shopDomain, token, 'pages.json?limit=10&fields=id,title,handle,published_at');

  // Check custom collections
  const customColls = await shopify(shopDomain, token, 'custom_collections.json?limit=20&fields=id,title,handle,published_at');
  const smartColls = await shopify(shopDomain, token, 'smart_collections.json?limit=20&fields=id,title,handle,published_at');

  return Response.json({
    publications: pubGql?.data?.publications?.edges || [],
    publications_error: pubGql?.errors,
    active_products: activeCount.count,
    draft_products: draftCount.count,
    sample_products: products.products?.map(p => ({
      title: p.title,
      status: p.status,
      published_at: p.published_at,
      published_scope: p.published_scope,
    })),
    pages: pages.pages?.map(p => ({ title: p.title, handle: p.handle, published_at: p.published_at })),
    custom_collections: customColls.custom_collections?.map(c => ({ title: c.title, handle: c.handle })),
    smart_collections: smartColls.smart_collections?.map(c => ({ title: c.title, handle: c.handle })),
  });
});