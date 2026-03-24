/**
 * Shopify OAuth — Authorization Code Grant (manual / non-embedded)
 *
 * Implements Shopify's exact spec:
 *   https://shopify.dev/docs/apps/build/authentication-authorization/access-token-types/get-offline-access-tokens
 *
 * GET ?action=start              → redirect to Shopify authorization page
 * GET ?code=...&shop=...&hmac=... → OAuth callback: full security validation + token exchange
 * POST (no body)                 → return stable URLs for Shopify Partner Dashboard setup
 *
 * Required env vars:
 *   SHOPIFY_CLIENT_ID
 *   SHOPIFY_CLIENT_SECRET
 *   SHOPIFY_STORE_DOMAIN     — e.g. my-store.myshopify.com
 *   SHOPIFY_REDIRECT_URI     — stable callback URL, must match Partner Dashboard exactly
 *
 * App type: MANUAL OAuth (non-embedded). Not Shopify managed installation.
 * The redirect URI is fixed via SHOPIFY_REDIRECT_URI env var — never changes between deploys.
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

// ── Crypto helpers ────────────────────────────────────────────────────────

async function hmacSha256Hex(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function randomHex(bytes = 16) {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── State: signed nonce (stateless — no DB needed) ────────────────────────
// state = nonce + "." + HMAC(nonce, clientSecret)
// On callback: split, re-sign nonce, compare. Tamper-proof without DB.

async function createSignedState(clientSecret) {
  const nonce = randomHex(16);
  const sig = await hmacSha256Hex(clientSecret, nonce);
  return `${nonce}.${sig}`;
}

async function verifySignedState(state, clientSecret) {
  if (!state || !state.includes('.')) return false;
  const dot = state.lastIndexOf('.');
  const nonce = state.slice(0, dot);
  const sig = state.slice(dot + 1);
  const expected = await hmacSha256Hex(clientSecret, nonce);
  return expected === sig;
}

// ── HMAC validation — exact Shopify spec ──────────────────────────────────
// 1. Parse all query params
// 2. Remove hmac
// 3. Sort remaining keys alphabetically (as plain strings)
// 4. Join as "key=value&key=value"
// 5. HMAC-SHA256 with client secret
// Note: URLSearchParams decodes values. Shopify signs decoded values — this is correct.

async function validateHmac(rawQuery, clientSecret) {
  const parsed = new URLSearchParams(rawQuery);
  const receivedHmac = parsed.get('hmac');
  if (!receivedHmac) return { valid: false, reason: 'hmac param missing' };

  const pairs = [];
  for (const [k, v] of parsed.entries()) {
    if (k !== 'hmac') pairs.push([k, v]);
  }

  // Sort alphabetically by key (plain string sort, per Shopify spec)
  pairs.sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);

  const message = pairs.map(([k, v]) => `${k}=${v}`).join('&');
  const computed = await hmacSha256Hex(clientSecret, message);
  const valid = computed === receivedHmac;

  return {
    valid,
    message,
    received_hmac: receivedHmac,
    computed_hmac: computed,
    reason: valid ? 'ok' : 'hmac mismatch',
  };
}

// ── Shop validation ───────────────────────────────────────────────────────
function validateShop(shop) {
  // Must be a valid *.myshopify.com domain
  return /^[a-zA-Z0-9][a-zA-Z0-9\-]*\.myshopify\.com$/.test(shop);
}

// ── Token exchange ────────────────────────────────────────────────────────
async function exchangeCode(shop, clientId, clientSecret, code) {
  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed [${res.status}]: ${text}`);
  }
  return res.json();
}

// ── Persist session ───────────────────────────────────────────────────────
async function persistSession(base44, domain, tokenData) {
  const record = {
    shop_domain: domain,
    access_token: tokenData.access_token,
    token_type: 'Bearer',
    expires_at: null,
    scope: tokenData.scope || '',
  };
  const existing = await base44.asServiceRole.entities.ShopifySession.filter({ shop_domain: domain });
  if (existing.length > 0) {
    await base44.asServiceRole.entities.ShopifySession.update(existing[0].id, record);
  } else {
    await base44.asServiceRole.entities.ShopifySession.create(record);
  }
  return record;
}

// ── HTML response helper ──────────────────────────────────────────────────
function html(title, body) {
  return new Response(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
    <style>
      body{font-family:monospace;max-width:800px;margin:40px auto;padding:20px;background:#f5f5f5;color:#222}
      h2{margin-top:0}
      pre{background:#111;color:#0f0;padding:16px;border-radius:6px;white-space:pre-wrap;word-break:break-all;font-size:13px}
      .ok{color:#00cc66} .fail{color:#ff4444} .warn{color:#ffaa00}
      table{border-collapse:collapse;width:100%;margin:12px 0}
      td,th{padding:8px 12px;border:1px solid #ccc;text-align:left;font-size:13px}
      th{background:#e8e8e8}
      a{color:#0055cc}
    </style></head>
    <body>${body}</body></html>`,
    { headers: { 'Content-Type': 'text/html' } }
  );
}

// ── Main handler ──────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  const clientId     = Deno.env.get('SHOPIFY_CLIENT_ID');
  const clientSecret = Deno.env.get('SHOPIFY_CLIENT_SECRET');
  const storeDomain  = Deno.env.get('SHOPIFY_STORE_DOMAIN');
  const redirectUri  = Deno.env.get('SHOPIFY_REDIRECT_URI');

  if (!clientId || !clientSecret || !storeDomain) {
    return Response.json({ error: 'Missing SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET, or SHOPIFY_STORE_DOMAIN' }, { status: 500 });
  }

  // Dynamic URL fallback (only used for the setup info page — not for auth)
  const url = new URL(req.url);
  const dynamicBase = `${url.protocol}//${url.host}${url.pathname}`;
  const callbackUrl = redirectUri || dynamicBase;

  const rawQuery = url.search.startsWith('?') ? url.search.slice(1) : '';
  const params   = url.searchParams;

  // ── POST → return stable URLs for Shopify Partner Dashboard ──────────────
  if (req.method === 'POST') {
    return Response.json({
      app_type: 'Manual OAuth (non-embedded)',
      stable_start_url: `${callbackUrl}?action=start`,
      shopify_partner_dashboard: {
        app_url: callbackUrl,
        allowed_redirect_url: callbackUrl,
        note: 'Set SHOPIFY_REDIRECT_URI env var to lock in this URL permanently',
      },
      redirect_uri_source: redirectUri ? 'SHOPIFY_REDIRECT_URI env var (stable)' : 'dynamic (set SHOPIFY_REDIRECT_URI to stabilize)',
    });
  }

  if (req.method !== 'GET') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  // ── GET ?action=start → begin OAuth ──────────────────────────────────────
  if (params.get('action') === 'start') {
    const state = await createSignedState(clientSecret);
    const authUrl = new URL(`https://${storeDomain}/admin/oauth/authorize`);
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('scope', SCOPES);
    authUrl.searchParams.set('redirect_uri', callbackUrl);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('grant_options[]', 'offline');
    console.log('OAuth start', { state_nonce: state.split('.')[0], redirect_uri: callbackUrl });
    return Response.redirect(authUrl.toString(), 302);
  }

  // ── GET ?code=...&shop=... → OAuth callback ───────────────────────────────
  if (params.get('code') && params.get('shop')) {
    const shop  = params.get('shop');
    const code  = params.get('code');
    const state = params.get('state') || '';

    // Build deterministic debug report
    const report = {
      callback_url_used: callbackUrl,
      raw_query: rawQuery,
      checks: {},
    };

    // 1. HMAC verification
    const hmacResult = await validateHmac(rawQuery, clientSecret);
    report.checks.hmac = {
      passed: hmacResult.valid,
      message_signed: hmacResult.message,
      received: hmacResult.received_hmac,
      computed: hmacResult.computed_hmac,
      reason: hmacResult.reason,
    };

    // 2. State verification
    const stateValid = await verifySignedState(state, clientSecret);
    report.checks.state = {
      passed: stateValid,
      received_state: state,
      reason: stateValid ? 'ok' : 'state signature invalid or missing',
    };

    // 3. Shop domain validation
    const shopValid = validateShop(shop);
    report.checks.shop = {
      passed: shopValid,
      shop,
      reason: shopValid ? 'ok' : `"${shop}" is not a valid *.myshopify.com domain`,
    };

    // 4. Shop matches expected store
    const shopMatches = shop === storeDomain;
    report.checks.shop_match = {
      passed: shopMatches,
      expected: storeDomain,
      received: shop,
      reason: shopMatches ? 'ok' : 'shop does not match SHOPIFY_STORE_DOMAIN',
    };

    console.log('OAuth callback checks', report.checks);

    // Fail fast if any security check fails
    const allPassed = hmacResult.valid && stateValid && shopValid && shopMatches;
    if (!allPassed) {
      const failed = Object.entries(report.checks)
        .filter(([, v]) => !v.passed)
        .map(([k]) => k)
        .join(', ');

      return html('❌ OAuth Security Check Failed', `
        <h2 class="fail">❌ Security Check Failed</h2>
        <p>Failed checks: <strong>${failed}</strong></p>
        <h3>Debug Report</h3>
        <pre>${JSON.stringify(report, null, 2)}</pre>
      `);
    }

    // 5. Token exchange
    let tokenData;
    try {
      tokenData = await exchangeCode(shop, clientId, clientSecret, code);
      report.checks.token_exchange = { passed: true, scope: tokenData.scope };
    } catch (e) {
      report.checks.token_exchange = { passed: false, error: e.message };
      return html('❌ Token Exchange Failed', `
        <h2 class="fail">❌ Token Exchange Failed</h2>
        <pre>${JSON.stringify(report, null, 2)}</pre>
      `);
    }

    // 6. Persist session
    const base44 = createClientFromRequest(req);
    await persistSession(base44, shop, tokenData);
    report.token_stored = true;

    console.log('OAuth complete', { shop, scope: tokenData.scope });

    return html('✅ Shopify OAuth Complete', `
      <h2 class="ok">✅ OAuth Complete — Token Stored</h2>
      <table>
        <tr><th>Check</th><th>Result</th></tr>
        ${Object.entries(report.checks).map(([k, v]) =>
          `<tr><td>${k}</td><td class="${v.passed ? 'ok' : 'fail'}">${v.passed ? '✅ Pass' : '❌ Fail'}</td></tr>`
        ).join('')}
      </table>
      <h3>Full Debug Report</h3>
      <pre>${JSON.stringify(report, null, 2)}</pre>
    `);
  }

  // ── GET (no params) → setup instructions ──────────────────────────────────
  const uriSource = redirectUri ? 'SHOPIFY_REDIRECT_URI env var (stable ✅)' : 'dynamic URL (set SHOPIFY_REDIRECT_URI to stabilize ⚠️)';
  return html('Shopify OAuth Setup', `
    <h2>Shopify OAuth Setup</h2>
    <p><strong>App type:</strong> Manual OAuth (non-embedded)</p>
    <p><strong>Redirect URI source:</strong> ${uriSource}</p>

    <h3>Shopify Partner Dashboard — set both fields to:</h3>
    <pre>${callbackUrl}</pre>

    <table>
      <tr><th>Field</th><th>Value</th></tr>
      <tr><td>App URL</td><td>${callbackUrl}</td></tr>
      <tr><td>Allowed redirect URL</td><td>${callbackUrl}</td></tr>
    </table>

    <h3>Start OAuth:</h3>
    <p><a href="${callbackUrl}?action=start">${callbackUrl}?action=start</a></p>

    <h3>Required env vars:</h3>
    <pre>SHOPIFY_CLIENT_ID      ✅ set
SHOPIFY_CLIENT_SECRET  ✅ set
SHOPIFY_STORE_DOMAIN   ✅ set
SHOPIFY_REDIRECT_URI   ${redirectUri ? '✅ set → ' + redirectUri : '⚠️  NOT SET — set this to lock in a stable URL'}</pre>
  `);
});