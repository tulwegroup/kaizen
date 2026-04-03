/**
 * publishProductsToStorefront
 * Sets published_at on all active products so they appear on the Online Store channel.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

async function shopifyRequest(domain, token, method, path, body) {
  const res = await fetch(`https://${domain}/admin/api/2026-01/${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Shopify [${res.status}] ${JSON.stringify(data).slice(0, 300)}`);
  return data;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'POST only' }, { status: 405 });

  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const shopDomain = Deno.env.get('SHOPIFY_STORE_DOMAIN');
  const sessions = await base44.asServiceRole.entities.ShopifySession.filter({ shop_domain: shopDomain });
  const token = sessions[0]?.access_token;
  if (!token) return Response.json({ error: 'No Shopify session.' }, { status: 401 });

  // Fetch all products (active + draft), up to 250
  const data = await shopifyRequest(shopDomain, token, 'GET', 'products.json?limit=250&fields=id,title,status,published_at,published_scope');
  const products = data.products || [];

  const publishedAt = new Date().toISOString();
  let published = 0;
  let failed = 0;
  const errors = [];

  for (const product of products) {
    try {
      await shopifyRequest(shopDomain, token, 'PUT', `products/${product.id}.json`, {
        product: {
          id: product.id,
          status: 'active',
          published: true,
          published_at: publishedAt,
          published_scope: 'web',
        },
      });
      published++;
      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 200));
    } catch (e) {
      failed++;
      errors.push({ id: product.id, title: product.title, error: e.message });
    }
  }

  return Response.json({
    success: true,
    total: products.length,
    published,
    failed,
    errors: errors.slice(0, 10),
  });
});