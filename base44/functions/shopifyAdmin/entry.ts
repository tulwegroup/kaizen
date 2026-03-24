/**
 * Shopify Admin Service
 * Reads access token from ShopifySession entity (set via OAuth).
 * No SHOPIFY_ACCESS_TOKEN env var needed.
 *
 * Required env vars:
 *   SHOPIFY_STORE_DOMAIN — e.g. my-store.myshopify.com
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const SHOPIFY_API_VERSION = '2026-01';

const REQUIRED_WEBHOOKS = [
  { topic: 'orders/create',            format: 'json' },
  { topic: 'orders/updated',           format: 'json' },
  { topic: 'orders/cancelled',         format: 'json' },
  { topic: 'fulfillments/create',      format: 'json' },
  { topic: 'fulfillments/update',      format: 'json' },
  { topic: 'refunds/create',           format: 'json' },
  { topic: 'inventory_levels/update',  format: 'json' },
  { topic: 'customers/create',         format: 'json' },
  { topic: 'customers/update',         format: 'json' },
];

function shopifyUrl(domain, path) {
  return `https://${domain}/admin/api/${SHOPIFY_API_VERSION}${path}`;
}

async function shopifyRequest(domain, accessToken, method, path, body) {
  const url = shopifyUrl(domain, path);
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': accessToken,
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Shopify ${method} ${path} [${res.status}]: ${errText}`);
  }
  return res.json();
}

// ── Register all required webhooks idempotently ───────────────────────────
async function registerWebhooks(domain, accessToken, webhookBaseUrl) {
  const existing = await shopifyRequest(domain, accessToken, 'GET', '/webhooks.json?limit=250');
  const existingByTopic = {};
  for (const wh of (existing.webhooks || [])) {
    existingByTopic[wh.topic] = wh;
  }

  const results = [];

  for (const required of REQUIRED_WEBHOOKS) {
    const address = `${webhookBaseUrl}`;
    const existing_wh = existingByTopic[required.topic];

    if (existing_wh) {
      if (existing_wh.address === address) {
        results.push({ topic: required.topic, status: 'already_registered', id: existing_wh.id });
      } else {
        // Address mismatch — delete old, create new
        await shopifyRequest(domain, accessToken, 'DELETE', `/webhooks/${existing_wh.id}.json`);
        const created = await shopifyRequest(domain, accessToken, 'POST', '/webhooks.json', {
          webhook: { topic: required.topic, address, format: required.format },
        });
        results.push({ topic: required.topic, status: 're_registered', id: created.webhook.id });
      }
    } else {
      const created = await shopifyRequest(domain, accessToken, 'POST', '/webhooks.json', {
        webhook: { topic: required.topic, address, format: required.format },
      });
      results.push({ topic: required.topic, status: 'registered', id: created.webhook.id });
    }
  }

  return results;
}

// ── Connectivity test ─────────────────────────────────────────────────────
async function testConnectivity(domain, accessToken) {
  const shop = await shopifyRequest(domain, accessToken, 'GET', '/shop.json');
  return {
    connected: true,
    shop_name: shop.shop.name,
    shop_domain: shop.shop.domain,
    plan: shop.shop.plan_name,
    currency: shop.shop.currency,
    api_version: SHOPIFY_API_VERSION,
  };
}

// ── List + validate current webhook subscriptions ─────────────────────────
async function validateWebhooks(domain, accessToken, webhookBaseUrl) {
  const existing = await shopifyRequest(domain, accessToken, 'GET', '/webhooks.json?limit=250');
  const existingTopics = new Set((existing.webhooks || []).map(w => w.topic));
  const requiredTopics = new Set(REQUIRED_WEBHOOKS.map(w => w.topic));

  const missing = [...requiredTopics].filter(t => !existingTopics.has(t));
  const extra = [...existingTopics].filter(t => !requiredTopics.has(t));
  const addressMismatches = (existing.webhooks || []).filter(
    w => requiredTopics.has(w.topic) && w.address !== webhookBaseUrl
  );

  return {
    registered: existing.webhooks || [],
    missing_topics: missing,
    extra_topics: extra,
    address_mismatches: addressMismatches.map(w => ({ topic: w.topic, current: w.address, expected: webhookBaseUrl })),
    all_valid: missing.length === 0 && addressMismatches.length === 0,
  };
}

// ── Main handler ───────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const domain = Deno.env.get('SHOPIFY_STORE_DOMAIN');
  const appId = Deno.env.get('BASE44_APP_ID');
  if (!domain) {
    return Response.json({ error: 'Missing SHOPIFY_STORE_DOMAIN' }, { status: 500 });
  }

  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user || user.role !== 'admin') {
    return Response.json({ error: 'Admin access required' }, { status: 403 });
  }

  // Read access token from ShopifySession entity (stored via OAuth)
  const sessions = await base44.asServiceRole.entities.ShopifySession.filter({ shop_domain: domain });
  const accessToken = sessions[0]?.access_token;
  if (!accessToken) {
    return Response.json({ error: 'No Shopify session found. Complete OAuth first at /shopify-oauth?action=start' }, { status: 401 });
  }

  // Webhook URL derived from app ID — no env var needed
  const webhookBaseUrl = `https://app--${appId}.base44.app/api/apps/${appId}/functions/shopifyWebhooks`;

  const body = await req.json();
  const { action } = body;

  if (action === 'test_connectivity') {
    const result = await testConnectivity(domain, accessToken);
    return Response.json({ action, ...result });
  }

  if (action === 'register_webhooks') {
    if (!webhookBaseUrl) {
      return Response.json({
        error: 'SHOPIFY_WEBHOOK_BASE_URL env var required — set it to your shopifyWebhooks function URL'
      }, { status: 500 });
    }
    const results = await registerWebhooks(domain, accessToken, webhookBaseUrl);
    const registered = results.filter(r => r.status === 'registered').length;
    const reregistered = results.filter(r => r.status === 're_registered').length;
    const already = results.filter(r => r.status === 'already_registered').length;
    return Response.json({
      action,
      webhook_base_url: webhookBaseUrl,
      results,
      summary: { registered, re_registered: reregistered, already_registered: already, total: results.length },
    });
  }

  if (action === 'validate_webhooks') {
    if (!webhookBaseUrl) {
      return Response.json({ error: 'SHOPIFY_WEBHOOK_BASE_URL env var required' }, { status: 500 });
    }
    const result = await validateWebhooks(domain, accessToken, webhookBaseUrl);
    return Response.json({ action, ...result });
  }

  if (action === 'list_mappings') {
    const { entity_type, limit = 50 } = body;
    const filter = { shop_domain: domain };
    if (entity_type) filter.entity_type = entity_type;
    const mappings = await base44.asServiceRole.entities.ShopifyMapping.filter(filter);
    return Response.json({ action, count: mappings.length, mappings: mappings.slice(0, limit) });
  }

  if (action === 'list_dead_letters') {
    const { status = 'pending_retry' } = body;
    const letters = await base44.asServiceRole.entities.ShopifyDeadLetter.filter({
      shop_domain: domain,
      status,
    });
    return Response.json({ action, count: letters.length, dead_letters: letters });
  }

  if (action === 'full_validation_report') {
    const report = { timestamp: new Date().toISOString(), domain };

    // 1. Connectivity
    try {
      report.connectivity = await testConnectivity(domain, accessToken);
    } catch (e) {
      report.connectivity = { connected: false, error: e.message };
    }

    // 2. Webhooks
    if (webhookBaseUrl) {
      try {
        report.webhooks = await validateWebhooks(domain, accessToken, webhookBaseUrl);
      } catch (e) {
        report.webhooks = { error: e.message };
      }
    } else {
      report.webhooks = { skipped: true, reason: 'SHOPIFY_WEBHOOK_BASE_URL not set' };
    }

    // 3. Mappings summary
    const mappings = await base44.asServiceRole.entities.ShopifyMapping.filter({ shop_domain: domain });
    const byType = {};
    for (const m of mappings) {
      byType[m.entity_type] = (byType[m.entity_type] || 0) + 1;
    }
    report.mappings = { total: mappings.length, by_type: byType };

    // 4. Dead letter summary
    const deadLetters = await base44.asServiceRole.entities.ShopifyDeadLetter.filter({
      shop_domain: domain,
      status: 'pending_retry',
    });
    report.dead_letters = { pending_retry: deadLetters.length };

    return Response.json({ action, report });
  }

  return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
});