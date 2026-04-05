/**
 * configureThemeSections
 * Reads the active theme's settings_data.json and updates section collection references.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

async function shopifyGet(domain, token, path) {
  const res = await fetch(`https://${domain}/admin/api/2024-01/${path}`, {
    headers: { 'X-Shopify-Access-Token': token },
  });
  return res.json();
}

async function shopifyPut(domain, token, path, body) {
  const res = await fetch(`https://${domain}/admin/api/2024-01/${path}`, {
    method: 'PUT',
    headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'POST only' }, { status: 405 });

  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user || user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

  const sessions = await base44.asServiceRole.entities.ShopifySession.filter({});
  const session = sessions[0];
  if (!session) return Response.json({ error: 'No session' }, { status: 400 });

  const { access_token: token, shop_domain: domain } = session;

  // Step 1: Get all themes and find the active one
  const themesData = await shopifyGet(domain, token, 'themes.json');
  const activeTheme = (themesData.themes || []).find(t => t.role === 'main');
  if (!activeTheme) return Response.json({ error: 'No active theme found', themes: themesData.themes }, { status: 400 });

  // Step 2: Get collection IDs
  const customColls = await shopifyGet(domain, token, 'custom_collections.json?limit=250');
  const collections = customColls.custom_collections || [];

  const flashDeals = collections.find(c => c.handle === 'flash-deals');
  const bestSellers = collections.find(c => c.handle === 'best-sellers');
  const newArrivals = collections.find(c => c.handle === 'new-arrivals');
  const frontpage = collections.find(c => c.handle === 'frontpage');

  // Step 3: Get existing settings_data.json
  const assetRes = await shopifyGet(domain, token, `themes/${activeTheme.id}/assets.json?asset[key]=config/settings_data.json`);
  let settingsData = {};
  
  try {
    const rawValue = assetRes.asset?.value;
    if (rawValue) settingsData = JSON.parse(rawValue);
  } catch (e) {
    settingsData = {};
  }

  // Step 4: Build the updated sections config
  // Ensure the sections structure exists
  if (!settingsData.current) settingsData.current = {};
  if (!settingsData.current.sections) settingsData.current.sections = {};

  const sections = settingsData.current.sections;

  // Update flash-deals-row section
  if (flashDeals) {
    const fdKey = Object.keys(sections).find(k => 
      sections[k].type === 'flash-deals-row' || 
      sections[k].type?.includes('flash') ||
      k.includes('flash')
    );
    if (fdKey) {
      sections[fdKey].settings = { ...sections[fdKey].settings, collection: `gid://shopify/Collection/${flashDeals.id}` };
    } else {
      sections['flash-deals-row'] = {
        type: 'flash-deals-row',
        settings: { collection: `gid://shopify/Collection/${flashDeals.id}`, heading: '🔥 Flash Deals', products_count: 8 }
      };
    }
  }

  // Update product-grid section (best sellers)
  if (bestSellers) {
    const pgKey = Object.keys(sections).find(k =>
      sections[k].type === 'product-grid' ||
      sections[k].type?.includes('product-grid') ||
      k.includes('product-grid')
    );
    if (pgKey) {
      sections[pgKey].settings = { ...sections[pgKey].settings, collection: `gid://shopify/Collection/${bestSellers.id}`, heading: 'Best Sellers' };
    } else {
      sections['product-grid'] = {
        type: 'product-grid',
        settings: { collection: `gid://shopify/Collection/${bestSellers.id}`, heading: 'Best Sellers', products_count: 8 }
      };
    }
  }

  // Ensure order includes our sections
  if (!settingsData.current.order) settingsData.current.order = [];
  if (!settingsData.current.order.includes('flash-deals-row')) {
    settingsData.current.order.splice(2, 0, 'flash-deals-row');
  }
  if (!settingsData.current.order.includes('product-grid')) {
    settingsData.current.order.splice(4, 0, 'product-grid');
  }

  // Step 5: Upload updated settings
  const updateRes = await shopifyPut(domain, token, `themes/${activeTheme.id}/assets.json`, {
    asset: {
      key: 'config/settings_data.json',
      value: JSON.stringify(settingsData, null, 2),
    }
  });

  return Response.json({
    success: true,
    theme: { id: activeTheme.id, name: activeTheme.name },
    collections_found: {
      flash_deals: flashDeals ? { id: flashDeals.id, handle: flashDeals.handle } : null,
      best_sellers: bestSellers ? { id: bestSellers.id, handle: bestSellers.handle } : null,
      new_arrivals: newArrivals ? { id: newArrivals.id, handle: newArrivals.handle } : null,
    },
    settings_updated: !!updateRes.asset,
    sections_configured: Object.keys(sections),
    raw_settings_preview: JSON.stringify(settingsData).slice(0, 500),
  });
});