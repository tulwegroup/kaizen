/**
 * Order Router — Canonical Order → CJ Fulfillment Bridge
 *
 * This is the core routing layer that connects inbound Shopify orders
 * to CJ order submission, and propagates tracking back to Shopify.
 *
 * Actions:
 *   route_order              — take a canonical order, resolve CJ variant mappings, submit to CJ
 *   push_tracking_to_shopify — fetch CJ tracking and create Shopify fulfillment
 *   route_from_shopify_event — accept a normalized Shopify order event and route it end-to-end
 *   get_order_pipeline_status — full status of an order across Shopify + CJ mappings
 *
 * Required env vars:
 *   CJ_EMAIL
 *   CJ_API_KEY
 *   SHOPIFY_ACCESS_TOKEN
 *   SHOPIFY_STORE_DOMAIN
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const CJ_BASE = 'https://developers.cjdropshipping.com/api2.0/v1';
const SHOPIFY_API_VERSION = '2026-01';

// ── CJ auth (persistent token via CJSession entity) ───────────────────────
async function getCJToken(base44, email, apiKey) {
  const now = Date.now();
  const sessions = await base44.asServiceRole.entities.CJSession.filter({ email });
  const session = sessions[0];

  if (session?.access_token && session.expires_at > now + 300_000) {
    return session.access_token;
  }

  if (session?.refresh_token && session.expires_at > now - 3_600_000) {
    try {
      const res = await fetch(`${CJ_BASE}/authentication/refreshAccessToken`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'refreshToken': session.refresh_token },
      });
      const data = await res.json();
      if (data.result === true && data.data?.accessToken) {
        const updated = {
          access_token: data.data.accessToken,
          refresh_token: data.data.refreshToken || session.refresh_token,
          expires_at: now + (data.data.expiresIn || 86400) * 1000,
          email,
        };
        await base44.asServiceRole.entities.CJSession.update(session.id, updated);
        return updated.access_token;
      }
    } catch (_) { /* fall through */ }
  }

  const res = await fetch(`${CJ_BASE}/authentication/getAccessToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: apiKey }),
  });
  const data = await res.json();
  if (data.result !== true || !data.data?.accessToken) {
    throw new Error(`CJ auth failed: ${data.message}`);
  }
  const newSession = {
    access_token: data.data.accessToken,
    refresh_token: data.data.refreshToken || null,
    expires_at: now + (data.data.expiresIn || 86400) * 1000,
    email,
  };
  if (session) {
    await base44.asServiceRole.entities.CJSession.update(session.id, newSession);
  } else {
    await base44.asServiceRole.entities.CJSession.create(newSession);
  }
  return newSession.access_token;
}

async function cjPost(token, path, body) {
  const res = await fetch(`${CJ_BASE}${path}`, {
    method: 'POST',
    headers: { 'CJ-Access-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (data.result === false) {
    const err = new Error(`CJ POST [${path}]: ${data.message}`);
    err.cjCode = data.code;
    err.cjMessage = data.message;
    throw err;
  }
  return data.data || data;
}

async function cjGet(token, path, params) {
  const url = new URL(`${CJ_BASE}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
  }
  const res = await fetch(url.toString(), {
    headers: { 'CJ-Access-Token': token, 'Content-Type': 'application/json' },
  });
  const data = await res.json();
  if (data.result === false) {
    throw new Error(`CJ GET [${path}]: ${data.message}`);
  }
  return data.data || data;
}

// ── Shopify API helpers ───────────────────────────────────────────────────
function shopifyUrl(domain, path) {
  return `https://${domain}/admin/api/${SHOPIFY_API_VERSION}${path}`;
}

async function shopifyRequest(domain, accessToken, method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': accessToken },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(shopifyUrl(domain, path), opts);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopify ${method} ${path} [${res.status}]: ${text}`);
  }
  return res.json();
}

// ── CJ Status normalization ───────────────────────────────────────────────
const CJ_STATUS_MAP = {
  CREATED: 'pending', IN_CART: 'pending', UNPAID: 'pending',
  UNSHIPPED: 'processing', WAIT_SHIP: 'processing',
  SHIPPED: 'shipped', DELIVERING: 'in_transit',
  FINISHED: 'delivered', CANCELLED: 'cancelled',
  FAILED: 'failed', REJECTED: 'failed',
  REFUNDED: 'refunded', PART_REFUNDED: 'partially_refunded',
};

function normalizeStatus(raw) {
  if (!raw) return 'unknown';
  const upper = raw.toUpperCase().replace(/[\s-]+/g, '_');
  return CJ_STATUS_MAP[upper] || `unmapped:${raw}`;
}

// ── Core: route a canonical order to CJ ───────────────────────────────────
async function routeOrderToCJ(base44, cjToken, canonicalOrder, corrId) {
  const canonicalOrderId = canonicalOrder.canonical_order_id;

  // Idempotency check
  const existing = await base44.asServiceRole.entities.CJMapping.filter({
    entity_type: 'order', canonical_id: canonicalOrderId,
  });
  if (existing.length > 0) {
    return {
      status: 'already_routed',
      cj_order_id: existing[0].cj_id,
      message: 'Order already submitted to CJ',
    };
  }

  // Resolve CJ variant mappings for each line item
  const products = [];
  const unmappedVariants = [];

  for (const li of canonicalOrder.line_items) {
    // Try canonical variant ID first, then Shopify variant ID
    let maps = [];
    if (li.canonical_variant_id) {
      maps = await base44.asServiceRole.entities.CJMapping.filter({
        entity_type: 'variant', canonical_id: li.canonical_variant_id,
      });
    }
    // Fallback: look up by shopify_variant_id stored in metadata
    if (maps.length === 0 && li.shopify_variant_id) {
      const allVariantMaps = await base44.asServiceRole.entities.CJMapping.filter({ entity_type: 'variant' });
      const found = allVariantMaps.find(m => m.metadata?.shopify_variant_id === li.shopify_variant_id);
      if (found) maps = [found];
    }

    if (maps.length === 0) {
      unmappedVariants.push(li.canonical_variant_id || li.shopify_variant_id || li.sku || 'unknown');
      continue;
    }

    products.push({ vid: maps[0].cj_id, quantity: li.quantity });
  }

  if (unmappedVariants.length > 0 && products.length === 0) {
    throw Object.assign(
      new Error(`No CJ variant mappings found for: ${unmappedVariants.join(', ')}`),
      { failureClass: 'product_mapping_failure' }
    );
  }

  const addr = canonicalOrder.shipping_address;
  const cjPayload = {
    orderNumber: canonicalOrderId,
    shippingZip: addr.zip || addr.postal_code || '',
    shippingCountryCode: addr.country_code || '',
    shippingCountry: addr.country_name || addr.country || '',
    shippingProvince: addr.province || addr.state || '',
    shippingCity: addr.city || '',
    shippingAddress: addr.address1 || addr.address || '',
    shippingAddress2: addr.address2 || '',
    shippingCustomerName: addr.name || `${addr.first_name || ''} ${addr.last_name || ''}`.trim(),
    shippingPhone: addr.phone || '',
    remark: canonicalOrder.remark || '',
    products,
  };

  const cjResult = await cjPost(cjToken, '/shopping/order/createOrder', cjPayload);
  const cjOrderId = cjResult.orderId || cjResult.id || String(cjResult);

  await base44.asServiceRole.entities.CJMapping.create({
    entity_type: 'order',
    canonical_id: canonicalOrderId,
    cj_id: cjOrderId,
    sync_status: 'synced',
    canonical_status: 'pending',
    cj_status_raw: 'CREATED',
    last_synced_at: new Date().toISOString(),
    metadata: {
      correlation_id: corrId,
      submitted_at: new Date().toISOString(),
      shopify_order_id: canonicalOrder.shopify_order_id || null,
      unmapped_variants: unmappedVariants,
    },
  });

  console.log('Order routed to CJ', { canonical_order_id: canonicalOrderId, cj_order_id: cjOrderId, corrId });
  return { status: 'submitted', cj_order_id: cjOrderId, unmapped_variants: unmappedVariants };
}

// ── Push tracking + fulfillment back to Shopify ───────────────────────────
async function pushTrackingToShopify(base44, cjToken, shopifyDomain, shopifyAccessToken, canonicalOrderId, corrId) {
  // 1. Find CJ order mapping
  const orderMaps = await base44.asServiceRole.entities.CJMapping.filter({
    entity_type: 'order', canonical_id: canonicalOrderId,
  });
  if (orderMaps.length === 0) {
    return { status: 'no_cj_mapping', canonical_order_id: canonicalOrderId };
  }
  const orderMap = orderMaps[0];

  // 2. Fetch tracking from CJ
  let trackData;
  try {
    trackData = await cjGet(cjToken, '/logistic/trackInfo/getTrackInfo', { orderId: orderMap.cj_id });
  } catch (e) {
    return { status: 'tracking_unavailable', error: e.message };
  }

  const trackingNumber = trackData.trackNumber || null;
  const carrier = trackData.shippingCarrier || trackData.logisticName || null;

  if (!trackingNumber) {
    return { status: 'no_tracking_yet', cj_order_id: orderMap.cj_id };
  }

  // 3. Find Shopify order ID from mapping metadata
  const shopifyOrderId = orderMap.metadata?.shopify_order_id;
  if (!shopifyOrderId) {
    return { status: 'no_shopify_order_id', message: 'shopify_order_id not stored in mapping metadata' };
  }

  // 4. Get Shopify order fulfillment orders
  let fulfillmentOrders;
  try {
    const foResult = await shopifyRequest(
      shopifyDomain, shopifyAccessToken, 'GET',
      `/orders/${shopifyOrderId}/fulfillment_orders.json`
    );
    fulfillmentOrders = foResult.fulfillment_orders || [];
  } catch (e) {
    return { status: 'shopify_fulfillment_order_fetch_failed', error: e.message };
  }

  const openFO = fulfillmentOrders.find(fo => fo.status === 'open' || fo.status === 'in_progress');
  if (!openFO) {
    return { status: 'no_open_fulfillment_order', shopify_order_id: shopifyOrderId };
  }

  // 5. Create Shopify fulfillment
  const fulfillmentPayload = {
    fulfillment: {
      line_items_by_fulfillment_order: [
        { fulfillment_order_id: openFO.id },
      ],
      tracking_info: {
        number: trackingNumber,
        company: carrier || 'CJdropshipping',
      },
      notify_customer: true,
    },
  };

  let shopifyFulfillment;
  try {
    const result = await shopifyRequest(
      shopifyDomain, shopifyAccessToken, 'POST',
      '/fulfillments.json', fulfillmentPayload
    );
    shopifyFulfillment = result.fulfillment;
  } catch (e) {
    return { status: 'shopify_fulfillment_create_failed', error: e.message };
  }

  // 6. Write Shopify fulfillment mapping
  await base44.asServiceRole.entities.ShopifyMapping.create({
    entity_type: 'fulfillment',
    canonical_id: `fulfillment_${canonicalOrderId}`,
    shopify_id: String(shopifyFulfillment.id),
    shop_domain: shopifyDomain,
    sync_status: 'synced',
    last_synced_at: new Date().toISOString(),
    metadata: {
      canonical_order_id: canonicalOrderId,
      cj_order_id: orderMap.cj_id,
      tracking_number: trackingNumber,
      carrier,
    },
  });

  // 7. Update CJ order mapping with tracking
  await base44.asServiceRole.entities.CJMapping.update(orderMap.id, {
    sync_status: 'synced',
    canonical_status: 'shipped',
    cj_status_raw: 'SHIPPED',
    last_synced_at: new Date().toISOString(),
    metadata: { ...orderMap.metadata, tracking_number: trackingNumber, carrier },
  });

  console.log('Tracking pushed to Shopify', {
    canonical_order_id: canonicalOrderId,
    shopify_fulfillment_id: shopifyFulfillment.id,
    tracking_number: trackingNumber,
    corrId,
  });

  return {
    status: 'success',
    shopify_fulfillment_id: String(shopifyFulfillment.id),
    tracking_number: trackingNumber,
    carrier,
    shopify_order_id: shopifyOrderId,
    cj_order_id: orderMap.cj_id,
  };
}

// ── Main handler ──────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

  const cjEmail = Deno.env.get('CJ_EMAIL');
  const cjApiKey = Deno.env.get('CJ_API_KEY');
  const shopifyAccessToken = Deno.env.get('SHOPIFY_ACCESS_TOKEN');
  const shopifyDomain = Deno.env.get('SHOPIFY_STORE_DOMAIN');

  if (!cjEmail || !cjApiKey) return Response.json({ error: 'Missing CJ_EMAIL or CJ_API_KEY' }, { status: 500 });

  const base44 = createClientFromRequest(req);
  // Allow both authenticated users and internal service-role invocations
  const isAuthenticated = await base44.auth.isAuthenticated();
  if (!isAuthenticated) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { action } = body;
  const corrId = body.correlation_id || `router-${Date.now()}`;

  let cjToken;
  try {
    cjToken = await getCJToken(base44, cjEmail, cjApiKey);
  } catch (e) {
    return Response.json({ error: 'CJ auth failed', detail: e.message }, { status: 502 });
  }

  // ── route_order ───────────────────────────────────────────────────────────
  if (action === 'route_order') {
    const { order } = body;
    if (!order?.canonical_order_id || !order?.line_items || !order?.shipping_address) {
      return Response.json({ error: 'order with canonical_order_id, line_items, and shipping_address required' }, { status: 400 });
    }
    try {
      const result = await routeOrderToCJ(base44, cjToken, order, corrId);
      return Response.json({ action, correlation_id: corrId, ...result });
    } catch (e) {
      await base44.asServiceRole.entities.CJDeadLetter.create({
        operation: 'order_submit',
        failure_class: e.failureClass || 'order_submission_failure',
        canonical_id: order.canonical_order_id,
        failure_reason: e.message,
        request_payload: JSON.stringify(order),
        status: 'pending_retry',
        correlation_id: corrId,
      });
      return Response.json({ error: e.message, correlation_id: corrId }, { status: 502 });
    }
  }

  // ── push_tracking_to_shopify ──────────────────────────────────────────────
  if (action === 'push_tracking_to_shopify') {
    const { canonical_order_id } = body;
    if (!canonical_order_id) return Response.json({ error: 'canonical_order_id required' }, { status: 400 });
    if (!shopifyAccessToken || !shopifyDomain) {
      return Response.json({ error: 'Missing SHOPIFY_ACCESS_TOKEN or SHOPIFY_STORE_DOMAIN' }, { status: 500 });
    }
    const result = await pushTrackingToShopify(base44, cjToken, shopifyDomain, shopifyAccessToken, canonical_order_id, corrId);
    return Response.json({ action, correlation_id: corrId, ...result });
  }

  // ── route_from_shopify_event ──────────────────────────────────────────────
  // Accepts a canonical Shopify order event (as produced by shopifyWebhooks normalizer)
  // and routes it end-to-end: maps line items, submits to CJ, writes audit trail.
  if (action === 'route_from_shopify_event') {
    const { shopify_event } = body;
    if (!shopify_event?.shopify_order_id) {
      return Response.json({ error: 'shopify_event with shopify_order_id required' }, { status: 400 });
    }

    const shopifyOrderId = shopify_event.shopify_order_id;
    const canonicalOrderId = `order_shopify_${shopifyOrderId}`;

    // Build canonical order from Shopify event line items
    // Each line item needs a canonical_variant_id — we try to find it from ShopifyMapping
    const canonicalLineItems = [];
    for (const li of (shopify_event.line_items || [])) {
      const shopifyVariantId = li.shopify_variant_id;
      // Find canonical variant ID from ShopifyMapping
      const variantMaps = await base44.asServiceRole.entities.ShopifyMapping.filter({
        entity_type: 'variant',
        shopify_id: shopifyVariantId,
      });
      canonicalLineItems.push({
        canonical_variant_id: variantMaps.length > 0 ? variantMaps[0].canonical_id : null,
        shopify_variant_id: shopifyVariantId,
        sku: li.sku,
        quantity: li.quantity,
      });
    }

    const addr = shopify_event.shipping_address || {};
    const canonicalOrder = {
      canonical_order_id: canonicalOrderId,
      shopify_order_id: shopifyOrderId,
      line_items: canonicalLineItems,
      shipping_address: {
        name: addr.name || '',
        first_name: addr.first_name || '',
        last_name: addr.last_name || '',
        address1: addr.address1 || '',
        address2: addr.address2 || '',
        city: addr.city || '',
        province: addr.province || '',
        country: addr.country || '',
        country_code: addr.country_code || '',
        zip: addr.zip || '',
        phone: addr.phone || '',
      },
    };

    try {
      const result = await routeOrderToCJ(base44, cjToken, canonicalOrder, corrId);
      return Response.json({ action, canonical_order_id: canonicalOrderId, shopify_order_id: shopifyOrderId, correlation_id: corrId, ...result });
    } catch (e) {
      await base44.asServiceRole.entities.CJDeadLetter.create({
        operation: 'order_submit',
        failure_class: e.failureClass || 'order_submission_failure',
        canonical_id: canonicalOrderId,
        failure_reason: e.message,
        request_payload: JSON.stringify(canonicalOrder),
        status: 'pending_retry',
        correlation_id: corrId,
      });
      return Response.json({ error: e.message, canonical_order_id: canonicalOrderId, correlation_id: corrId }, { status: 502 });
    }
  }

  // ── get_order_pipeline_status ─────────────────────────────────────────────
  if (action === 'get_order_pipeline_status') {
    const { canonical_order_id, shopify_order_id } = body;
    const canonicalId = canonical_order_id || (shopify_order_id ? `order_shopify_${shopify_order_id}` : null);
    if (!canonicalId) return Response.json({ error: 'canonical_order_id or shopify_order_id required' }, { status: 400 });

    const [cjMaps, shopifyMaps, fulfillmentMaps] = await Promise.all([
      base44.asServiceRole.entities.CJMapping.filter({ entity_type: 'order', canonical_id: canonicalId }),
      base44.asServiceRole.entities.ShopifyMapping.filter({ entity_type: 'order', canonical_id: canonicalId }),
      base44.asServiceRole.entities.CJMapping.filter({ entity_type: 'shipment', canonical_id: canonicalId }),
    ]);

    return Response.json({
      action,
      canonical_order_id: canonicalId,
      shopify_order: shopifyMaps[0] || null,
      cj_order: cjMaps[0] || null,
      shipment: fulfillmentMaps[0] || null,
      pipeline_status: {
        shopify_mapped: shopifyMaps.length > 0,
        routed_to_cj: cjMaps.length > 0,
        tracking_received: fulfillmentMaps.length > 0,
        cj_status: cjMaps[0]?.canonical_status || 'not_routed',
        tracking_number: cjMaps[0]?.metadata?.tracking_number || fulfillmentMaps[0]?.metadata?.tracking_number || null,
      },
      correlation_id: corrId,
    });
  }

  return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
});