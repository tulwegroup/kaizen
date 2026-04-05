/**
 * deepDiagnostic — checks collections, collects, and product channel visibility
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

async function shopify(domain, token, path) {
  const res = await fetch(`https://${domain}/admin/api/2024-01/${path}`, {
    headers: { 'X-Shopify-Access-Token': token },
  });
  return res.json();
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'POST only' }, { status: 405 });

  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const sessions = await base44.asServiceRole.entities.ShopifySession.filter({});
  const session = sessions[0];
  if (!session) return Response.json({ error: 'No session' }, { status: 400 });

  const { access_token: token, shop_domain: domain } = session;

  // Get all custom collections with product counts
  const customColls = await shopify(domain, token, 'custom_collections.json?limit=250');
  const customWithCounts = await Promise.all(
    (customColls.custom_collections || []).map(async (c) => {
      const countRes = await shopify(domain, token, `custom_collections/${c.id}/products/count.json`);
      return { title: c.title, handle: c.handle, id: c.id, product_count: countRes.count };
    })
  );

  // Get all smart collections with product counts
  const smartColls = await shopify(domain, token, 'smart_collections.json?limit=250');
  const smartWithCounts = await Promise.all(
    (smartColls.smart_collections || []).map(async (c) => {
      const countRes = await shopify(domain, token, `smart_collections/${c.id}/products/count.json`);
      return { title: c.title, handle: c.handle, id: c.id, product_count: countRes.count };
    })
  );

  // Check the token scopes
  const shopData = await shopify(domain, token, 'shop.json');

  // Sample first product to check channel data
  const products = await shopify(domain, token, 'products.json?limit=1&fields=id,title,status,published_at,published_scope');

  return Response.json({
    shop: shopData.shop?.name,
    custom_collections: customWithCounts,
    smart_collections: smartWithCounts,
    sample_product: products.products?.[0],
    token_scope: session.scope,
  });
});