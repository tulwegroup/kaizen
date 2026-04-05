/**
 * fixShopifyCollections
 * Deletes the empty custom "all" collection and creates smart collections that auto-populate.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

async function shopify(domain, token, method, path, body) {
  const res = await fetch(`https://${domain}/admin/api/2024-01/${path}`, {
    method,
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (method === 'DELETE') return { status: res.status };
  return res.json();
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'POST only' }, { status: 405 });

  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user || user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

  const sessions = await base44.asServiceRole.entities.ShopifySession.filter({});
  const session = sessions[0];
  if (!session) return Response.json({ error: 'No Shopify session found' }, { status: 400 });

  const { access_token: token, shop_domain: domain } = session;
  const results = [];

  // Step 1: Find and delete the empty custom "all" collection that's blocking the built-in
  const customColls = await shopify(domain, token, 'GET', 'custom_collections.json?limit=250');
  const allColl = (customColls.custom_collections || []).find(c => c.handle === 'all');
  if (allColl) {
    await shopify(domain, token, 'DELETE', `custom_collections/${allColl.id}.json`);
    results.push({ action: 'deleted_custom_all_collection', id: allColl.id });
  }

  // Step 2: Create smart collections that auto-populate
  const SMART_COLLECTIONS = [
    {
      title: 'New Arrivals',
      handle: 'new-arrivals',
      body_html: 'The latest products added to our store — refreshed every week.',
      sort_order: 'created-desc',
      rules: [{ column: 'tag', relation: 'equals', condition: 'new-arrival' }],
      disjunctive: false,
    },
    {
      title: 'Best Sellers',
      handle: 'best-sellers',
      body_html: 'Our most popular products loved by thousands of customers worldwide.',
      sort_order: 'best-selling',
      rules: [{ column: 'title', relation: 'not_contains', condition: 'ZZZNOMATCH' }],
      disjunctive: false,
    },
    {
      title: 'Flash Deals',
      handle: 'flash-deals',
      body_html: 'Limited-time offers at the lowest prices. Shop fast — stock is limited!',
      sort_order: 'best-selling',
      rules: [{ column: 'title', relation: 'not_contains', condition: 'ZZZNOMATCH' }],
      disjunctive: false,
    },
  ];

  // First remove existing smart collections with same handles
  const existingSmart = await shopify(domain, token, 'GET', 'smart_collections.json?limit=250');
  for (const sc of (existingSmart.smart_collections || [])) {
    if (['new-arrivals', 'best-sellers', 'flash-deals'].includes(sc.handle)) {
      await shopify(domain, token, 'DELETE', `smart_collections/${sc.id}.json`);
      results.push({ action: 'deleted_old_smart_collection', handle: sc.handle });
    }
  }

  // Also delete matching custom collections
  for (const cc of (customColls.custom_collections || [])) {
    if (['new-arrivals', 'flash-deals', 'best-sellers'].includes(cc.handle)) {
      await shopify(domain, token, 'DELETE', `custom_collections/${cc.id}.json`);
      results.push({ action: 'deleted_old_custom_collection', handle: cc.handle });
    }
  }

  // Create new smart collections
  for (const col of SMART_COLLECTIONS) {
    const res = await shopify(domain, token, 'POST', 'smart_collections.json', {
      smart_collection: { ...col, published: true }
    });
    if (res.smart_collection) {
      results.push({ action: 'created_smart_collection', handle: col.handle, id: res.smart_collection.id });
    } else {
      results.push({ action: 'failed_smart_collection', handle: col.handle, error: JSON.stringify(res) });
    }
  }

  // Step 3: Ensure all products are active
  const products = await shopify(domain, token, 'GET', 'products.json?limit=250&fields=id,status');
  let activated = 0;
  for (const p of (products.products || [])) {
    if (p.status !== 'active') {
      await shopify(domain, token, 'PUT', `products/${p.id}.json`, {
        product: { id: p.id, status: 'active', published: true, published_at: new Date().toISOString() }
      });
      activated++;
      await new Promise(r => setTimeout(r, 150));
    }
  }

  return Response.json({
    success: true,
    total_products: products.products?.length || 0,
    activated,
    results,
    message: 'Collections fixed. The built-in /collections/all now auto-shows all active products.',
  });
});