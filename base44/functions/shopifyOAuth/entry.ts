/**
 * Shopify OAuth — Authorization Code Grant Flow
 *
 * GET ?action=start           → redirect browser to Shopify authorization page
 * GET ?code=...&shop=...&hmac=... → OAuth callback: validate, exchange, persist token
 * POST (no body)              → return function URLs for setup reference
 *
 * Required env vars:
 *   SHOPIFY_CLIENT_ID
 *   SHOPIFY_CLIENT_SECRET
 *   SHOPIFY_STORE_DOMAIN
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const SHOPIFY_API_VERSION = '2026-01';

const SCOPES = [
  'read_products', 'write_products',
  'read_orders', 'write_orders',
  'read_fulfillments', 'write_fulfillments',
  'read_inventory', 'write_inventory',
  'read_customers',
].join(',');

// ── HMAC validation ───────────────────────────────────────────────────────
// Uses raw query string to preserve exact encoding Shopify signed
async function validateHmac(rawQuery, clientSecret) {
  const pairs = [];
  let hmac = null;

  for (const part of rawQuery.split('&')) {
    const eqIdx = part.indexOf('=');
    const k = part.slice(0, eqIdx);
    const v = part.slice(eqIdx + 1);
    if (k === 'hmac') {
      hmac = v;
    } else {
      pairs.push(`${k}=${v}`);
    }
  }

  if (!hmac) return false;
  pairs.sort();
  const message = pairs.join('&');

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(clientSecret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  const computed = Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0')).join('');
  return computed === hmac;
}

function generateState() {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function exchangeCode(shop, clientId, clientSecret, code) {
  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Code exchange failed [${res.status}]: ${text}`);
  }
  return res.json();
}

async function persistSession(base44, domain, tokenData) {
  const sessionRecord = {
    shop_domain: domain,
    access_token: tokenData.access_token,
    token_type: 'Bearer',
    expires_at: null,
    scope: tokenData.scope || '',
  };
  const existing = await base44.asServiceRole.entities.ShopifySession.filter({ shop_domain: domain });
  if (existing.length > 0) {
    await base44.asServiceRole.entities.ShopifySession.update(existing[0].id, sessionRecord);
  } else {
    await base44.asServiceRole.entities.ShopifySession.create(sessionRecord);
  }
  console.log('ShopifySession persisted', { domain, scope: sessionRecord.scope });
  return sessionRecord;
}

async function validateToken(domain, accessToken) {
  const res = await fetch(`https://${domain}/admin/api/${SHOPIFY_API_VERSION}/shop.json`, {
    headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopify validation failed [${res.status}]: ${text}`);
  }
  const data = await res.json();
  const s = data.shop;
  return {
    shop_name: s.name,
    shop_domain: s.domain,
    plan: s.plan_name,
    currency: s.currency,
    timezone: s.iana_timezone,
    api_version: SHOPIFY_API_VERSION,
  };
}

function htmlPage(title, bodyHtml) {
  return new Response(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
    <style>body{font-family:monospace;max-width:700px;margin:60px auto;padding:20px;background:#f9f9f9}
    pre{background:#111;color:#0f0;padding:20px;border-radius:8px;white-space:pre-wrap;word-break:break-all}
    h2{color:#111}p{color:#444}a{color:#0066cc}</style></head>
    <body>${bodyHtml}</body></html>`,
    { headers: { 'Content-Type': 'text/html' } }
  );
}

// ── Main handler ──────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  const clientId = Deno.env.get('SHOPIFY_CLIENT_ID');
  const clientSecret = Deno.env.get('SHOPIFY_CLIENT_SECRET');
  const expectedDomain = Deno.env.get('SHOPIFY_STORE_DOMAIN');

  if (!clientId || !clientSecret || !expectedDomain) {
    return Response.json({ error: 'Missing SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET, or SHOPIFY_STORE_DOMAIN' }, { status: 500 });
  }

  const url = new URL(req.url);
  const params = url.searchParams;
  const functionBaseUrl = `${url.protocol}//${url.host}${url.pathname}`;

  // POST → return URLs for setup reference
  if (req.method === 'POST') {
    return Response.json({
      function_url: functionBaseUrl,
      start_url: `${functionBaseUrl}?action=start`,
      shopify_app_url: functionBaseUrl,
      shopify_allowed_redirect_url: functionBaseUrl,
    });
  }

  if (req.method !== 'GET') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  // GET ?action=start → redirect to Shopify authorization page
  if (params.get('action') === 'start') {
    const state = generateState();
    const authUrl = new URL(`https://${expectedDomain}/admin/oauth/authorize`);
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('scope', SCOPES);
    authUrl.searchParams.set('redirect_uri', functionBaseUrl);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('grant_options[]', 'offline');
    console.log('OAuth start', { state, redirect_uri: functionBaseUrl });
    return Response.redirect(authUrl.toString(), 302);
  }

  // GET ?code=...&shop=... → OAuth callback
  if (params.get('code') && params.get('shop')) {
    const shop = params.get('shop');
    const code = params.get('code');

    if (shop !== expectedDomain) {
      return htmlPage('OAuth Error', `<h2>❌ Shop mismatch</h2><p>Expected: <b>${expectedDomain}</b><br>Got: <b>${shop}</b></p>`);
    }

    // Validate HMAC using raw query string
    const rawQuery = url.search.slice(1); // strip leading '?'
    const hmacValid = await validateHmac(rawQuery, clientSecret);
    if (!hmacValid) {
      console.error('HMAC failed', { rawQuery });
      return htmlPage('OAuth Error', `<h2>❌ HMAC validation failed</h2><p>Request may have been tampered with.</p><pre>Raw query: ${rawQuery}</pre>`);
    }

    let tokenData;
    try {
      tokenData = await exchangeCode(shop, clientId, clientSecret, code);
    } catch (e) {
      return htmlPage('OAuth Error', `<h2>❌ Code exchange failed</h2><pre>${e.message}</pre>`);
    }

    const base44 = createClientFromRequest(req);
    const session = await persistSession(base44, shop, tokenData);

    let shopInfo;
    let validationStatus = 'PASS';
    let validationError = null;
    try {
      shopInfo = await validateToken(shop, session.access_token);
    } catch (e) {
      validationStatus = 'FAIL';
      validationError = e.message;
    }

    const result = {
      oauth_complete: true,
      token_stored: true,
      shop_domain: shop,
      scope: session.scope,
      token_expiry: 'Never (offline token)',
      validation: validationStatus === 'PASS'
        ? { status: 'PASS', shop: shopInfo }
        : { status: 'FAIL', error: validationError },
    };

    console.log('OAuth complete', { shop, scope: session.scope, validation: validationStatus });

    return htmlPage('✅ Shopify OAuth Complete', `
      <h2>✅ OAuth Complete — Token Stored</h2>
      <p>Shop: <b>${shopInfo?.shop_name || shop}</b> | Scopes: <b>${session.scope}</b></p>
      <p>Validation: <b style="color:${validationStatus === 'PASS' ? 'green' : 'red'}">${validationStatus}</b></p>
      <pre>${JSON.stringify(result, null, 2)}</pre>
    `);
  }

  // GET (no params) → setup instructions
  return htmlPage('Shopify OAuth Setup', `
    <h2>Shopify OAuth Setup</h2>
    <p>In <b>Shopify Partner Dashboard → App setup</b>, set both fields to:</p>
    <pre>${functionBaseUrl}</pre>
    <h3>Start the OAuth flow:</h3>
    <p><a href="${functionBaseUrl}?action=start">${functionBaseUrl}?action=start</a></p>
  `);
});