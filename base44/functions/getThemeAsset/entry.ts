/**
 * getThemeAsset — reads a specific asset from the active Shopify theme
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

async function shopifyGet(domain, token, path) {
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
  const { asset_key } = await req.json();

  // Find active theme
  const themesData = await shopifyGet(domain, token, 'themes.json');
  const activeTheme = (themesData.themes || []).find(t => t.role === 'main');
  if (!activeTheme) return Response.json({ error: 'No active theme' }, { status: 400 });

  // List all assets if no key specified
  if (!asset_key) {
    const assets = await shopifyGet(domain, token, `themes/${activeTheme.id}/assets.json`);
    return Response.json({
      theme: activeTheme.name,
      assets: (assets.assets || []).map(a => a.key),
    });
  }

  // Get specific asset
  const encoded = encodeURIComponent(asset_key);
  const assetRes = await shopifyGet(domain, token, `themes/${activeTheme.id}/assets.json?asset[key]=${encoded}`);
  return Response.json({
    theme: activeTheme.name,
    key: asset_key,
    value: assetRes.asset?.value || assetRes,
  });
});