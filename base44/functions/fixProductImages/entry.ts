/**
 * fixProductImages
 * Loops through all Shopify products, fetches a real image via AI internet search,
 * and updates the product image in Shopify.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'POST only' }, { status: 405 });

  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { product_ids } = await req.json(); // optional array of specific product IDs to fix

  // Get Shopify session
  const sessions = await base44.asServiceRole.entities.ShopifySession.list('-created_date', 1);
  if (!sessions.length) return Response.json({ error: 'No Shopify session found' }, { status: 400 });
  const { shop_domain, access_token } = sessions[0];

  // Fetch products from Shopify
  let url = `https://${shop_domain}/admin/api/2024-01/products.json?limit=250&fields=id,title,images,variants`;
  const shopRes = await fetch(url, { headers: { 'X-Shopify-Access-Token': access_token } });
  const shopData = await shopRes.json();
  let products = shopData.products || [];

  if (product_ids?.length) {
    products = products.filter(p => product_ids.includes(String(p.id)));
  }

  const results = { fixed: 0, failed: 0, skipped: 0, details: [] };

  for (const product of products) {
    const title = product.title;

    // Check if image already looks real (not a placeholder)
    const existingImg = product.images?.[0]?.src || '';
    const isPlaceholder = !existingImg ||
      existingImg.includes('placeholder') ||
      existingImg.includes('no-image') ||
      existingImg.includes('cdn.shopify.com/s/files/1/0533'); // common Shopify placeholder

    if (!isPlaceholder && product.images?.length > 0) {
      results.skipped++;
      results.details.push({ id: product.id, title, status: 'skipped', reason: 'already has image' });
      continue;
    }

    try {
      // Use AI with internet search to find a real product image
      const aiRes = await base44.integrations.Core.InvokeLLM({
        model: 'gemini_3_flash',
        prompt: `Find a real, high-quality product image URL for: "${title}". 
Return only a direct image URL (ending in .jpg, .jpeg, .png, or .webp) from a reputable e-commerce site like Amazon, AliExpress, or manufacturer site. 
The image must be publicly accessible. Return just the URL, nothing else.`,
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            image_url: { type: 'string' },
            source: { type: 'string' }
          }
        }
      });

      const imageUrl = aiRes?.image_url;
      if (!imageUrl || !imageUrl.startsWith('http')) {
        results.failed++;
        results.details.push({ id: product.id, title, status: 'failed', reason: 'no valid image URL returned' });
        continue;
      }

      // Update product image in Shopify
      const updateRes = await fetch(`https://${shop_domain}/admin/api/2024-01/products/${product.id}/images.json`, {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': access_token,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image: { src: imageUrl, position: 1 } }),
      });

      if (updateRes.ok) {
        results.fixed++;
        results.details.push({ id: product.id, title, status: 'fixed', image_url: imageUrl });
      } else {
        const errData = await updateRes.json();
        results.failed++;
        results.details.push({ id: product.id, title, status: 'failed', reason: JSON.stringify(errData.errors) });
      }
    } catch (err) {
      results.failed++;
      results.details.push({ id: product.id, title, status: 'failed', reason: err.message });
    }
  }

  return Response.json({ success: true, total: products.length, ...results });
});