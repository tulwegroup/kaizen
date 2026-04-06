/**
 * fixThemeTemplates
 * Adds missing templates and fixes collection product linking.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

async function shopifyGet(domain, token, path) {
  const res = await fetch(`https://${domain}/admin/api/2024-01/${path}`, {
    headers: { 'X-Shopify-Access-Token': token },
  });
  return res.json();
}

async function shopifyPost(domain, token, path, body) {
  const res = await fetch(`https://${domain}/admin/api/2024-01/${path}`, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function shopifyPut(domain, token, themeId, key, value) {
  const res = await fetch(`https://${domain}/admin/api/2024-01/themes/${themeId}/assets.json`, {
    method: 'PUT',
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ asset: { key, value } }),
  });
  const json = await res.json();
  return { ok: res.ok, status: res.status, json };
}

// Simple page template - no schema block (theme uses liquid templates not JSON sections)
const PAGE_LIQUID = `<div style="max-width:860px;margin:40px auto;padding:0 24px 60px;">
  <p style="font-size:13px;color:#888;margin-bottom:16px;"><a href="/" style="color:#888;text-decoration:none;">Home</a> &rsaquo; {{ page.title }}</p>
  <h1 style="font-size:28px;font-weight:700;margin-bottom:24px;color:#111;">{{ page.title }}</h1>
  <div style="font-size:15px;line-height:1.75;color:#333;">{{ page.content }}</div>
</div>`;

const NOT_FOUND_LIQUID = `<div style="text-align:center;padding:80px 20px;">
  <h1 style="font-size:64px;font-weight:900;color:#111;margin:0;">404</h1>
  <p style="font-size:20px;color:#555;margin:16px 0;">Page not found</p>
  <a href="/" style="display:inline-block;background:#111;color:#fff;padding:12px 32px;border-radius:6px;text-decoration:none;font-weight:600;margin-top:16px;">Back to Home</a>
</div>`;

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'POST only' }, { status: 405 });

  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user || user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

  const sessions = await base44.asServiceRole.entities.ShopifySession.filter({});
  const session = sessions[0];
  if (!session) return Response.json({ error: 'No session' }, { status: 400 });

  const { access_token: token, shop_domain: domain } = session;

  // Get active theme
  const themesData = await shopifyGet(domain, token, 'themes.json');
  const activeTheme = (themesData.themes || []).find(t => t.role === 'main');
  if (!activeTheme) return Response.json({ error: 'No active theme' }, { status: 400 });

  const themeId = activeTheme.id;

  // Upload templates
  const [pageRes, notFoundRes] = await Promise.all([
    shopifyPut(domain, token, themeId, 'templates/page.liquid', PAGE_LIQUID),
    shopifyPut(domain, token, themeId, 'templates/404.liquid', NOT_FOUND_LIQUID),
  ]);

  // Check collects count for our custom collections
  const customData = await shopifyGet(domain, token, 'custom_collections.json?limit=250');
  const collections = customData.custom_collections || [];

  const targetHandles = ['flash-deals', 'best-sellers', 'new-arrivals'];
  const targetCols = collections.filter(c => targetHandles.includes(c.handle));

  const countResults = {};
  for (const col of targetCols) {
    const countRes = await shopifyGet(domain, token, `collects/count.json?collection_id=${col.id}`);
    countResults[col.handle] = { id: col.id, collects: countRes.count };
  }

  // Repopulate empty collections
  const emptyHandles = Object.entries(countResults)
    .filter(([, v]) => v.collects === 0)
    .map(([h]) => h);

  let repopulateResult = null;
  if (emptyHandles.length > 0) {
    const productData = await shopifyGet(domain, token, 'products.json?limit=250&fields=id&status=active');
    const products = productData.products || [];
    let added = 0;
    for (const handle of emptyHandles) {
      const colId = countResults[handle].id;
      for (const product of products) {
        await shopifyPost(domain, token, 'collects.json', {
          collect: { product_id: product.id, collection_id: colId }
        });
        added++;
        await new Promise(r => setTimeout(r, 40));
      }
    }
    repopulateResult = { empty_collections: emptyHandles, products_count: products.length, collects_added: added };
  }

  return Response.json({
    success: true,
    theme: activeTheme.name,
    page_template: { ok: pageRes.ok, status: pageRes.status, asset_key: pageRes.json?.asset?.key, errors: pageRes.json?.errors },
    not_found_template: { ok: notFoundRes.ok, status: notFoundRes.status, asset_key: notFoundRes.json?.asset?.key },
    collection_collects: countResults,
    repopulated: emptyHandles.length > 0,
    repopulate_result: repopulateResult,
  });
});