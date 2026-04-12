/**
 * populateCollections
 * Recreates Flash Deals + Best Sellers as custom collections and bulk-adds ALL products to them.
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

  const sessions = await base44.asServiceRole.entities.ShopifySession.filter({});
  const session = sessions[0];
  if (!session) return Response.json({ error: 'No Shopify session' }, { status: 400 });

  const { access_token: token, shop_domain: domain } = session;

  // Step 1: Get all active products
  const productData = await shopify(domain, token, 'GET', 'products.json?limit=250&fields=id,title&status=active');
  const products = productData.products || [];

  // Step 2: Delete old smart collections for these handles
  const smartData = await shopify(domain, token, 'GET', 'smart_collections.json?limit=250');
  const targetHandles = ['flash-deals', 'best-sellers', 'new-arrivals'];
  for (const sc of (smartData.smart_collections || [])) {
    if (targetHandles.includes(sc.handle)) {
      await shopify(domain, token, 'DELETE', `smart_collections/${sc.id}.json`);
    }
  }

  // Step 3: Delete old custom collections for these handles
  const customData = await shopify(domain, token, 'GET', 'custom_collections.json?limit=250');
  for (const cc of (customData.custom_collections || [])) {
    if (targetHandles.includes(cc.handle)) {
      await shopify(domain, token, 'DELETE', `custom_collections/${cc.id}.json`);
    }
  }

  // Step 4: Create fresh custom collections
  const COLLECTIONS = [
    { title: 'Flash Deals', handle: 'flash-deals', body_html: 'Limited-time offers at unbeatable prices.' },
    { title: 'Best Sellers', handle: 'best-sellers', body_html: 'Our most popular products.' },
    { title: 'New Arrivals', handle: 'new-arrivals', body_html: 'The latest products added to our store.' },
  ];

  const createdCollections = [];
  for (const col of COLLECTIONS) {
    const res = await shopify(domain, token, 'POST', 'custom_collections.json', {
      custom_collection: { title: col.title, handle: col.handle, body_html: col.body_html, published: true, sort_order: 'best-selling' }
    });
    if (res.custom_collection) {
      createdCollections.push({ handle: col.handle, id: res.custom_collection.id });
    }
  }

  // Step 5: Add ALL products to each collection via Collects API
  let collectsAdded = 0;
  for (const col of createdCollections) {
    for (const product of products) {
      await shopify(domain, token, 'POST', 'collects.json', {
        collect: { product_id: product.id, collection_id: col.id }
      });
      collectsAdded++;
      // Small delay to avoid rate limits
      await new Promise(r => setTimeout(r, 50));
    }
  }

  return Response.json({
    success: true,
    products_total: products.length,
    collections_created: createdCollections.length,
    collects_added: collectsAdded,
    collections: createdCollections,
    message: `All ${products.length} products added to ${createdCollections.length} collections.`,
  });
});