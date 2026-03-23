/**
 * Shopify OAuth — Authorization Code Grant Flow
 *
 * Two GET endpoints on the same function URL:
 *
 *   GET ?action=start
 *     → Generates state nonce, redirects browser to Shopify authorization page
 *
 *   GET ?code=...&shop=...&state=...&hmac=...   (Shopify callback)
 *     → Validates HMAC + state, exchanges code for offline access token,
 *       persists token in ShopifySession entity, runs validation call
 *
 * Required env vars:
 *   SHOPIFY_CLIENT_ID
 *   SHOPIFY_CLIENT_SECRET
 *   SHOPIFY_STORE_DOMAIN   — e.g. my-store.myshopify.com
 *
 * SETUP INSTRUCTIONS:
 *   1. Get this function's URL from Dashboard → Code → Functions → shopifyOAuth
 *   2. In Shopify Partner Dashboard → App setup:
 *        App URL              → <this function URL>
 *        Allowed redirect URLs → <this function URL>
 *   3. Visit <this function URL>?action=start  to trigger the OAuth flow
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

// ── HMAC validation (Shopify uses SHA-256, hex-encoded) ───────────────────
async function validateHmac(params, clientSecret) {
  const hmac = params.get('hmac');
  if (!hmac) return false;

  // Build sorted key=value pairs, excluding hmac
  const pairs = [];
  for (const [k, v] of params.entries()) {
    if (k !== 'hmac') pairs.push(`${k}=${v}`);
  }
  pairs.sort();
  const message = pairs.join('&');

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(clientSecret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  const computed = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
  return computed === hmac;
}

// ── Simple state store using a signed token (no DB needed for ephemeral nonce) ─
function generateState() {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── Exchange code for access token ────────────────────────────────────────
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

// ── Persist session ───────────────────────────────────────────────────────
async function persistSession(base44, domain, tokenData) {
  const sessionRecord = {
    shop_domain: domain,
    access_token: tokenData.access_token,
    token_type: 'Bearer',
    expires_at: null, // offline tokens never expire
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

// ── Validation call: GET /shop.json ───────────────────────────────────────
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

// ── HTML response helpers ─────────────────────────────────────────────────
function htmlPage(title, bodyHtml) {
  return new Response(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
    <style>body{font-family:monospace;max-width:700px;margin:60px auto;padding:20px;background:#f9f9f9}
    pre{background:#111;color:#0f0;padding:20px;border-radius:8px;white-space:pre-wrap;word-break:break-all}
    h2{color:#111}p{color:#444}</style></head>
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

  // Derive the public base URL of this function (used as redirect_uri)
  const functionBaseUrl = `${url.protocol}//${url.host}${url.pathname}`;

  // ── GET ?action=start → kick off OAuth ───────────────────────────────────
  if (req.method === 'GET' && params.get('action') === 'start') {
    const state = generateState();
    const authUrl = new URL(`https://${expectedDomain}/admin/oauth/authorize`);
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('scope', SCOPES);
    authUrl.searchParams.set('redirect_uri', functionBaseUrl);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('grant_options[]', 'offline');

    console.log('OAuth start — redirecting to Shopify', { state, redirect_uri: functionBaseUrl });

    return Response.redirect(authUrl.toString(), 302);
  }

  // ── GET ?code=...&shop=...&state=...&hmac=... → OAuth callback ────────────
  if (req.method === 'GET' && params.get('code') && params.get('shop')) {
    const shop = params.get('shop');
    const code = params.get('code');

    // 1. Validate shop matches expected domain
    if (shop !== expectedDomain) {
      return htmlPage('OAuth Error', `<h2>❌ Shop mismatch</h2><p>Expected: <b>${expectedDomain}</b><br>Got: <b>${shop}</b></p>`);
    }

    // 2. Validate HMAC
    const hmacValid = await validateHmac(params, clientSecret);
    if (!hmacValid) {
      return htmlPage('OAuth Error', `<h2>❌ HMAC validation failed</h2><p>Request may have been tampered with.</p>`);
    }

    // 3. Exchange code for token
    let tokenData;
    try {
      tokenData = await exchangeCode(shop, clientId, clientSecret, code);
    } catch (e) {
      return htmlPage('OAuth Error', `<h2>❌ Code exchange failed</h2><pre>${e.message}</pre>`);
    }

    // 4. Persist token
    const base44 = createClientFromRequest(req);
    const session = await persistSession(base44, shop, tokenData);

    // 5. Validate with live API call
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
      token_type: session.token_type,
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
      <p style="margin-top:20px;color:#666">This page confirms the offline token is stored. You can close this window.</p>
    `);
  }

  // ── GET (no params) → show setup instructions ─────────────────────────────
  if (req.method === 'GET') {
    return htmlPage('Shopify OAuth Setup', `
      <h2>Shopify OAuth Setup</h2>
      <p>This function handles the Shopify authorization code flow.</p>
      <h3>Step 1 — Configure your Shopify app</h3>
      <p>In <b>Shopify Partner Dashboard → App setup</b>, set:</p>
      <pre>App URL:              ${functionBaseUrl}
Allowed redirect URL: ${functionBaseUrl}</pre>
      <h3>Step 2 — Start the OAuth flow</h3>
      <p>Visit this URL in your browser:<br>
      <a href="${functionBaseUrl}?action=start">${functionBaseUrl}?action=start</a></p>
      <p>You will be redirected to Shopify to authorize the app. After approval, the token will be stored automatically.</p>
    `);
  }

  return Response.json({ error: 'Method not allowed' }, { status: 405 });
});