/**
 * fixProductImages
 * Fixes missing/placeholder product images by fetching real ones via AI web search.
 * Processes up to `limit` products per call to avoid timeouts.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'POST only' }, { status: 405 });

  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { product_ids, limit = 10 } = await req.json();

  // Get Shopify session
  const sessions = await base44.asServiceRole.entities.ShopifySession.list('-created_date', 1);
  if (!sessions.length) return Response.json({ error: 'No Shopify session found' }, { status: 400 });
  const { shop_domain, access_token } = sessions[0];

  // Fetch products from Shopify
  const shopRes = await fetch(
    `https://${shop_domain}/admin/api/2024-01/products.json?limit=250&fields=id,title,images`,
    { headers: { 'X-Shopify-Access-Token': access_token } }
  );
  const shopData = await shopRes.json();
  let products = shopData.products || [];

  // Filter to specific IDs if provided
  if (product_ids?.length) {
    products = products.filter(p => product_ids.includes(String(p.id)));
  }

  // Only process products missing a real image
  products = products.filter(p => {
    const img = p.images?.[0]?.src || '';
    return !img || img.includes('placeholder') || img.includes('no-image');
  });

  // Cap at limit to avoid timeout
  const totalNeedingFix = products.length;
  products = products.slice(0, limit);

  const results = { fixed: 0, failed: 0, skipped: 0, remaining: Math.max(0, totalNeedingFix - limit), details: [] };

  for (const product of products) {
    const title = product.title;
    try {
      const aiRes = await base44.integrations.Core.InvokeLLM({
        model: 'gemini_3_flash',
        prompt: `Find a real, high-quality product image URL for: "${title}". 
Return a direct image URL (ending in .jpg, .jpeg, .png, or .webp) from a reputable e-commerce or manufacturer site. 
Must be publicly accessible.`,
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            image_url: { type: 'string' },
          }
        }
      });

      const imageUrl = aiRes?.image_url;
      if (!imageUrl || !imageUrl.startsWith('http')) {
        results.failed++;
        results.details.push({ id: product.id, title, status: 'failed', reason: 'no valid image URL returned' });
        continue;
      }

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

  return Response.json({
    success: true,
    processed: products.length,
    total_needing_fix: totalNeedingFix,
    ...results,
    message: results.remaining > 0 ? `${results.remaining} more products still need fixing — click again to continue.` : 'All done!'
  });
});