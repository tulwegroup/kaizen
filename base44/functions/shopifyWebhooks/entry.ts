/**
 * Shopify Webhook Receiver
 * Handles all inbound Shopify webhook topics with HMAC validation,
 * deduplication, dead-letter routing, and canonical event normalization.
 *
 * Route: POST /
 * Topic is read from X-Shopify-Topic header.
 *
 * Required env vars:
 *   SHOPIFY_API_SECRET   — app API secret for HMAC validation
 *   SHOPIFY_STORE_DOMAIN — e.g. my-store.myshopify.com
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const SHOPIFY_API_VERSION = '2026-01';

const SUPPORTED_TOPICS = new Set([
  'orders/create',
  'orders/updated',
  'orders/cancelled',
  'fulfillments/create',
  'fulfillments/update',
  'refunds/create',
  'inventory_levels/update',
  'customers/create',
  'customers/update',
]);

// ── HMAC validation (Deno Web Crypto — must be async) ──────────────────────
async function validateHmac(rawBody, hmacHeader, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
  const computed = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return computed === hmacHeader;
}

// ── Canonical event normalizers per topic ──────────────────────────────────
function normalizeOrder(payload, topic, shopDomain) {
  return {
    event_type: topic === 'orders/create' ? 'commerce.order.created'
              : topic === 'orders/cancelled' ? 'commerce.order.cancelled'
              : 'commerce.order.updated',
    source: 'shopify_adapter',
    shop_domain: shopDomain,
    shopify_order_id: String(payload.id),
    order_number: payload.order_number,
    financial_status: payload.financial_status,
    fulfillment_status: payload.fulfillment_status,
    currency: payload.currency,
    total_price: payload.total_price,
    line_items: (payload.line_items || []).map(li => ({
      shopify_line_item_id: String(li.id),
      shopify_product_id: String(li.product_id),
      shopify_variant_id: String(li.variant_id),
      sku: li.sku,
      quantity: li.quantity,
      price: li.price,
      title: li.title,
      variant_title: li.variant_title,
    })),
    customer: payload.customer ? {
      shopify_customer_id: String(payload.customer.id),
      email: payload.customer.email,
    } : null,
    shipping_address: payload.shipping_address || null,
    created_at: payload.created_at,
    updated_at: payload.updated_at,
  };
}

function normalizeFulfillment(payload, topic, shopDomain) {
  return {
    event_type: topic === 'fulfillments/create'
      ? 'commerce.fulfillment.created'
      : 'commerce.fulfillment.updated',
    source: 'shopify_adapter',
    shop_domain: shopDomain,
    shopify_fulfillment_id: String(payload.id),
    shopify_order_id: String(payload.order_id),
    status: payload.status,
    tracking_number: payload.tracking_number,
    tracking_company: payload.tracking_company,
    tracking_url: payload.tracking_url,
    line_items: (payload.line_items || []).map(li => ({
      shopify_line_item_id: String(li.id),
      shopify_variant_id: String(li.variant_id),
      quantity: li.quantity,
    })),
    created_at: payload.created_at,
    updated_at: payload.updated_at,
  };
}

function normalizeRefund(payload, shopDomain) {
  return {
    event_type: 'commerce.refund.created',
    source: 'shopify_adapter',
    shop_domain: shopDomain,
    shopify_refund_id: String(payload.id),
    shopify_order_id: String(payload.order_id),
    refund_line_items: (payload.refund_line_items || []).map(rli => ({
      shopify_line_item_id: String(rli.line_item_id),
      quantity: rli.quantity,
      restock_type: rli.restock_type,
    })),
    transactions: (payload.transactions || []).map(t => ({
      shopify_transaction_id: String(t.id),
      amount: t.amount,
      currency: t.currency,
      gateway: t.gateway,
      status: t.status,
    })),
    created_at: payload.created_at,
  };
}

function normalizeInventory(payload, shopDomain) {
  return {
    event_type: 'supply.inventory.updated',
    source: 'shopify_adapter',
    shop_domain: shopDomain,
    shopify_inventory_item_id: String(payload.inventory_item_id),
    shopify_location_id: String(payload.location_id),
    available: payload.available,
    updated_at: payload.updated_at,
  };
}

function normalizeCustomer(payload, topic, shopDomain) {
  return {
    event_type: topic === 'customers/create'
      ? 'commerce.customer.created'
      : 'commerce.customer.updated',
    source: 'shopify_adapter',
    shop_domain: shopDomain,
    shopify_customer_id: String(payload.id),
    email: payload.email,
    first_name: payload.first_name,
    last_name: payload.last_name,
    orders_count: payload.orders_count,
    created_at: payload.created_at,
    updated_at: payload.updated_at,
  };
}

function buildCanonicalEvent(topic, payload, shopDomain) {
  if (topic === 'orders/create' || topic === 'orders/updated' || topic === 'orders/cancelled') {
    return normalizeOrder(payload, topic, shopDomain);
  }
  if (topic === 'fulfillments/create' || topic === 'fulfillments/update') {
    return normalizeFulfillment(payload, topic, shopDomain);
  }
  if (topic === 'refunds/create') {
    return normalizeRefund(payload, shopDomain);
  }
  if (topic === 'inventory_levels/update') {
    return normalizeInventory(payload, shopDomain);
  }
  if (topic === 'customers/create' || topic === 'customers/update') {
    return normalizeCustomer(payload, topic, shopDomain);
  }
  return { event_type: `shopify.${topic}`, source: 'shopify_adapter', raw: payload };
}

// ── Main handler ───────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const apiSecret = Deno.env.get('SHOPIFY_CLIENT_SECRET');
  const shopDomain = Deno.env.get('SHOPIFY_STORE_DOMAIN');

  if (!apiSecret || !shopDomain) {
    console.error('Missing required env vars: SHOPIFY_CLIENT_SECRET, SHOPIFY_STORE_DOMAIN');
    return Response.json({ error: 'Service misconfigured' }, { status: 500 });
  }

  const hmacHeader = req.headers.get('X-Shopify-Hmac-Sha256');
  const topic = req.headers.get('X-Shopify-Topic');
  const webhookId = req.headers.get('X-Shopify-Webhook-Id') || `no-id-${Date.now()}`;
  const receivedShopDomain = req.headers.get('X-Shopify-Shop-Domain') || shopDomain;

  const rawBody = await req.text();

  // ── HMAC validation ──────────────────────────────────────────────────────
  if (!hmacHeader) {
    console.warn('Webhook received without HMAC header — rejected');
    return Response.json({ error: 'Missing HMAC' }, { status: 401 });
  }

  const isValid = await validateHmac(rawBody, hmacHeader, apiSecret);
  console.log('HMAC check', {
    topic,
    webhookId,
    isValid,
    hmacHeader,
    secretPrefix: apiSecret?.substring(0, 6),
    bodyLength: rawBody.length,
  });
  if (!isValid) {
    console.warn('HMAC validation failed', { topic, webhookId });
    return Response.json({ error: 'HMAC validation failed' }, { status: 401 });
  }

  if (!topic || !SUPPORTED_TOPICS.has(topic)) {
    console.log('Unsupported or unknown topic — acknowledged', { topic, webhookId });
    return Response.json({ received: true, topic, processed: false });
  }

  const base44 = createClientFromRequest(req);

  // ── Deduplication via ShopifyDeadLetter lookup ───────────────────────────
  const existing = await base44.asServiceRole.entities.ShopifyDeadLetter.filter({
    shopify_webhook_id: webhookId,
    status: 'resolved',
  });
  if (existing.length > 0) {
    console.log('Duplicate webhook — already processed', { webhookId, topic });
    return Response.json({ received: true, duplicate: true });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch (e) {
    await base44.asServiceRole.entities.ShopifyDeadLetter.create({
      topic,
      shop_domain: receivedShopDomain,
      shopify_webhook_id: webhookId,
      raw_payload: rawBody,
      failure_reason: `JSON parse error: ${e.message}`,
      status: 'pending_retry',
      retry_count: 0,
    });
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // ── Normalize to canonical event ─────────────────────────────────────────
  let canonicalEvent;
  try {
    canonicalEvent = buildCanonicalEvent(topic, payload, receivedShopDomain);
  } catch (e) {
    await base44.asServiceRole.entities.ShopifyDeadLetter.create({
      topic,
      shop_domain: receivedShopDomain,
      shopify_webhook_id: webhookId,
      raw_payload: rawBody,
      failure_reason: `Normalization error: ${e.message}`,
      status: 'pending_retry',
      retry_count: 0,
    });
    console.error('Normalization failed', { topic, error: e.message });
    return Response.json({ error: 'Processing error' }, { status: 500 });
  }

  // ── Persist canonical event (store as resolved dead-letter = processed log) ─
  await base44.asServiceRole.entities.ShopifyDeadLetter.create({
    topic,
    shop_domain: receivedShopDomain,
    shopify_webhook_id: webhookId,
    raw_payload: JSON.stringify(canonicalEvent),
    failure_reason: 'none',
    status: 'resolved',
    retry_count: 0,
  });

  // ── Order ingestion: create/update canonical order mapping ───────────────
  if (topic === 'orders/create' || topic === 'orders/updated') {
    const shopifyOrderId = String(payload.id);
    const existingMapping = await base44.asServiceRole.entities.ShopifyMapping.filter({
      entity_type: 'order',
      shopify_id: shopifyOrderId,
      shop_domain: receivedShopDomain,
    });

    if (existingMapping.length === 0) {
      await base44.asServiceRole.entities.ShopifyMapping.create({
        entity_type: 'order',
        canonical_id: `order_shopify_${shopifyOrderId}`,
        shopify_id: shopifyOrderId,
        shop_domain: receivedShopDomain,
        sync_status: 'synced',
        last_synced_at: new Date().toISOString(),
        metadata: {
          order_number: payload.order_number,
          financial_status: payload.financial_status,
          total_price: payload.total_price,
        },
      });
    } else {
      await base44.asServiceRole.entities.ShopifyMapping.update(existingMapping[0].id, {
        sync_status: 'synced',
        last_synced_at: new Date().toISOString(),
        metadata: {
          order_number: payload.order_number,
          financial_status: payload.financial_status,
          fulfillment_status: payload.fulfillment_status,
          total_price: payload.total_price,
        },
      });
    }
  }

  // ── Fulfillment mapping ──────────────────────────────────────────────────
  if (topic === 'fulfillments/create' || topic === 'fulfillments/update') {
    const shopifyFulfillmentId = String(payload.id);
    const existingMapping = await base44.asServiceRole.entities.ShopifyMapping.filter({
      entity_type: 'fulfillment',
      shopify_id: shopifyFulfillmentId,
      shop_domain: receivedShopDomain,
    });

    if (existingMapping.length === 0) {
      await base44.asServiceRole.entities.ShopifyMapping.create({
        entity_type: 'fulfillment',
        canonical_id: `fulfillment_shopify_${shopifyFulfillmentId}`,
        shopify_id: shopifyFulfillmentId,
        shop_domain: receivedShopDomain,
        sync_status: 'synced',
        last_synced_at: new Date().toISOString(),
        metadata: {
          order_id: String(payload.order_id),
          status: payload.status,
          tracking_number: payload.tracking_number,
        },
      });
    } else {
      await base44.asServiceRole.entities.ShopifyMapping.update(existingMapping[0].id, {
        sync_status: 'synced',
        last_synced_at: new Date().toISOString(),
        metadata: {
          order_id: String(payload.order_id),
          status: payload.status,
          tracking_number: payload.tracking_number,
        },
      });
    }
  }

  console.log('Webhook processed', {
    topic,
    webhookId,
    shop: receivedShopDomain,
    event_type: canonicalEvent.event_type,
  });

  return Response.json({ received: true, event_type: canonicalEvent.event_type });
});