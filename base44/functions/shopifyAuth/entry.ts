/**
 * Shopify Admin API — Token Acquisition & Validation
 *
 * Implements the client_credentials grant for Shopify Dev Dashboard apps.
 * Token is persisted in ShopifySession entity to survive Deno isolate restarts.
 *
 * Actions:
 *   acquire_token  — fetch a fresh token via client_credentials and persist it
 *   get_token      — return persisted token, refreshing if expired
 *   validate       — confirm token is valid with a live authenticated Shopify read
 *   revoke         — clear the persisted session
 *
 * Required env vars:
 *   SHOPIFY_CLIENT_ID
 *   SHOPIFY_CLIENT_SECRET
 *   SHOPIFY_STORE_DOMAIN     — e.g. my-store.myshopify.com
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const SHOPIFY_API_VERSION = '2026-01';
const TOKEN_BUFFER_MS = 5 * 60 * 1000; // refresh 5 min before expiry

// ── Token acquisition via client_credentials grant ────────────────────────
async function fetchNewToken(domain, clientId, clientSecret) {
  const url = `https://${domain}/admin/oauth/access_token`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopify token request failed [${res.status}]: ${text}`);
  }

  const data = await res.json();

  if (!data.access_token) {
    throw new Error(`Shopify token response missing access_token: ${JSON.stringify(data)}`);
  }

  return data;
}

// ── Persist or update session in DB ──────────────────────────────────────
async function persistSession(base44, domain, tokenData) {
  const now = Date.now();

  // expires_in is in seconds; some Shopify tokens do not expire (offline tokens)
  const expiresAt = tokenData.expires_in
    ? now + tokenData.expires_in * 1000
    : null;

  const sessionRecord = {
    shop_domain: domain,
    access_token: tokenData.access_token,
    token_type: tokenData.token_type || 'Bearer',
    expires_at: expiresAt,
    scope: tokenData.scope || '',
  };

  const existing = await base44.asServiceRole.entities.ShopifySession.filter({ shop_domain: domain });
  if (existing.length > 0) {
    await base44.asServiceRole.entities.ShopifySession.update(existing[0].id, sessionRecord);
    console.log('ShopifySession updated', { domain, scope: sessionRecord.scope, expires_at: expiresAt });
  } else {
    await base44.asServiceRole.entities.ShopifySession.create(sessionRecord);
    console.log('ShopifySession created', { domain, scope: sessionRecord.scope, expires_at: expiresAt });
  }

  return sessionRecord;
}

// ── Get a valid token — refresh if expired ────────────────────────────────
async function getValidToken(base44, domain, clientId, clientSecret) {
  const now = Date.now();
  const sessions = await base44.asServiceRole.entities.ShopifySession.filter({ shop_domain: domain });
  const session = sessions[0];

  // Token exists and is not expired (or has no expiry — offline token)
  if (session?.access_token) {
    const notExpired = !session.expires_at || session.expires_at > now + TOKEN_BUFFER_MS;
    if (notExpired) {
      return { token: session.access_token, source: 'cached', scope: session.scope };
    }
    console.log('Shopify token expired or near expiry — refreshing');
  }

  // Acquire fresh token
  const tokenData = await fetchNewToken(domain, clientId, clientSecret);
  const persisted = await persistSession(base44, domain, tokenData);
  return { token: persisted.access_token, source: 'refreshed', scope: persisted.scope };
}

// ── Shopify API test call ─────────────────────────────────────────────────
async function shopifyTestRead(domain, accessToken) {
  const url = `https://${domain}/admin/api/${SHOPIFY_API_VERSION}/shop.json`;
  const res = await fetch(url, {
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopify API test read failed [${res.status}]: ${text}`);
  }

  const data = await res.json();
  const shop = data.shop;
  return {
    shop_name: shop.name,
    shop_domain: shop.domain,
    myshopify_domain: shop.myshopify_domain,
    plan: shop.plan_name,
    currency: shop.currency,
    country: shop.country_name,
    timezone: shop.iana_timezone,
    api_version: SHOPIFY_API_VERSION,
  };
}

// ── Main handler ──────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

  const clientId = Deno.env.get('SHOPIFY_CLIENT_ID');
  const clientSecret = Deno.env.get('SHOPIFY_CLIENT_SECRET');
  const domain = Deno.env.get('SHOPIFY_STORE_DOMAIN');

  if (!clientId || !clientSecret || !domain) {
    return Response.json({
      error: 'Missing required env vars: SHOPIFY_CLIENT_ID, SHOPIFY_CLIENT_SECRET, SHOPIFY_STORE_DOMAIN',
    }, { status: 500 });
  }

  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user || user.role !== 'admin') {
    return Response.json({ error: 'Admin access required' }, { status: 403 });
  }

  const body = await req.json();
  const { action } = body;

  // ── acquire_token ─────────────────────────────────────────────────────────
  if (action === 'acquire_token') {
    const tokenData = await fetchNewToken(domain, clientId, clientSecret);
    const persisted = await persistSession(base44, domain, tokenData);

    return Response.json({
      action,
      status: 'success',
      token_acquired: true,
      token_type: persisted.token_type,
      scope: persisted.scope,
      expires_at: persisted.expires_at,
      expires_at_human: persisted.expires_at ? new Date(persisted.expires_at).toISOString() : 'never (offline token)',
      refresh_handling: 'Token persisted in ShopifySession entity. Auto-refreshed on next get_token or validate call when within 5 minutes of expiry.',
    });
  }

  // ── get_token ─────────────────────────────────────────────────────────────
  if (action === 'get_token') {
    const { token, source, scope } = await getValidToken(base44, domain, clientId, clientSecret);
    return Response.json({
      action,
      status: 'success',
      token_available: true,
      source, // 'cached' or 'refreshed'
      scope,
      domain,
    });
  }

  // ── validate ──────────────────────────────────────────────────────────────
  if (action === 'validate') {
    const { token, source, scope } = await getValidToken(base44, domain, clientId, clientSecret);

    let shopInfo;
    try {
      shopInfo = await shopifyTestRead(domain, token);
    } catch (e) {
      return Response.json({
        action,
        token_acquired: true,
        token_source: source,
        scope,
        api_test: { status: 'FAIL', error: e.message },
        overall: 'FAIL',
      }, { status: 502 });
    }

    return Response.json({
      action,
      overall: 'PASS',
      token_acquired: true,
      token_source: source,
      refresh_handling: 'Implemented — token persisted in ShopifySession entity, auto-refreshed 5 min before expiry on every call',
      scope,
      api_test: {
        status: 'PASS',
        endpoint: `GET /admin/api/${SHOPIFY_API_VERSION}/shop.json`,
        result: shopInfo,
      },
    });
  }

  // ── revoke ────────────────────────────────────────────────────────────────
  if (action === 'revoke') {
    const sessions = await base44.asServiceRole.entities.ShopifySession.filter({ shop_domain: domain });
    for (const s of sessions) {
      await base44.asServiceRole.entities.ShopifySession.delete(s.id);
    }
    return Response.json({ action, status: 'success', message: `Cleared ${sessions.length} session(s) for ${domain}` });
  }

  return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
});