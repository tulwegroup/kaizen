/**
 * disableInventoryTracking
 * Sets all Shopify product variants to not track inventory,
 * so products never show as "Sold Out" (ideal for dropshipping).
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'POST only' }, { status: 405 });

  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  // Get Shopify session
  const sessions = await base44.asServiceRole.entities.ShopifySession.list('-created_date', 1);
  if (!sessions.length) return Response.json({ error: 'No Shopify session found' }, { status: 400 });
  const { shop_domain, access_token } = sessions[0];

  const headers = {
    'X-Shopify-Access-Token': access_token,
    'Content-Type': 'application/json',
  };

  // Fetch all products (paginated)
  let allProducts = [];
  let pageUrl = `https://${shop_domain}/admin/api/2024-01/products.json?limit=250&fields=id,title,variants`;
  while (pageUrl) {
    const res = await fetch(pageUrl, { headers });
    const data = await res.json();
    allProducts = allProducts.concat(data.products || []);
    // Check for next page via Link header
    const linkHeader = res.headers.get('Link') || '';
    const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
    pageUrl = nextMatch ? nextMatch[1] : null;
  }

  let fixed = 0;
  let failed = 0;

  for (const product of allProducts) {
    for (const variant of product.variants || []) {
      if (variant.inventory_management === null && variant.inventory_policy === 'continue') continue;
      
      const res = await fetch(`https://${shop_domain}/admin/api/2024-01/variants/${variant.id}.json`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          variant: {
            id: variant.id,
            inventory_management: null,  // disable tracking
            inventory_policy: 'continue', // sell even if out of stock
          }
        }),
      });

      if (res.ok) {
        fixed++;
      } else {
        failed++;
      }
    }
  }

  return Response.json({
    success: true,
    products_processed: allProducts.length,
    variants_fixed: fixed,
    variants_failed: failed,
    message: `Inventory tracking disabled on ${fixed} variants. Products will never show as sold out.`
  });
});