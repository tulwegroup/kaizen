/**
 * CJ Dropshipping — Order Submission, Tracking, and Fulfillment Sync
 *
 * Actions:
 *   submit_order         — push canonical routed order to CJ
 *   get_order_status     — fetch CJ order status and normalize
 *   get_tracking         — fetch tracking/carrier info for a CJ order
 *   sync_fulfillment     — fetch + persist latest fulfillment state for canonical order
 *   reconcile            — detect mapping drift and missing orders
 *
 * Required env vars:
 *   CJ_EMAIL
 *   CJ_API_KEY
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const CJ_BASE = 'https://developers.cjdropshipping.com/api2.0/v1';

// ── Token cache (per isolate) ──────────────────────────────────────────────
let _tokenCache = { token: null, expiresAt: 0, refreshToken: null };

async function getCJToken(email, apiKey) {
  const now = Date.now();
  if (_tokenCache.token && _tokenCache.expiresAt > now + 300_000) {
    return _tokenCache.token;
  }

  if (_tokenCache.refreshToken && _tokenCache.expiresAt > now - 3_600_000) {
    try {
      const res = await fetch(`${CJ_BASE}/authentication/refreshAccessToken`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json', 'refreshToken': _tokenCache.refreshToken },
      });
      const data = await res.json();
      if (data.result === true && data.data?.accessToken) {
        _tokenCache = {
          token: data.data.accessToken,
          refreshToken: data.data.refreshToken || _tokenCache.refreshToken,
          expiresAt: now + (data.data.expiresIn || 86400) * 1000,
        };
        return _tokenCache.token;
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
    const err = new Error(`CJ auth failed: ${data.message || JSON.stringify(data)}`);
    err.failureClass = 'auth_failure';
    throw err;
  }
  _tokenCache = {
    token: data.data.accessToken,
    refreshToken: data.data.refreshToken || null,
    expiresAt: now + (data.data.expiresIn || 86400) * 1000,
  };
  return _tokenCache.token;
}

async function cjPost(token, path, body) {
  const res = await fetch(`${CJ_BASE}${path}`, {
    method: 'POST',
    headers: { 'CJ-Access-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (data.result === false) {
    const err = new Error(`CJ API POST error [${path}]: ${data.message || JSON.stringify(data)}`);
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
    const err = new Error(`CJ API GET error [${path}]: ${data.message || JSON.stringify(data)}`);
    err.cjCode = data.code;
    err.cjMessage = data.message;
    throw err;
  }
  return data.data || data;
}

// ── CJ Status normalization ────────────────────────────────────────────────
const CJ_STATUS_MAP = {
  CREATED:         'pending',
  IN_CART:         'pending',
  UNPAID:          'pending',
  UNSHIPPED:       'processing',
  WAIT_SHIP:       'processing',
  SHIPPED:         'shipped',
  DELIVERING:      'in_transit',
  FINISHED:        'delivered',
  CANCELLED:       'cancelled',
  FAILED:          'failed',
  REJECTED:        'failed',
  REFUNDED:        'refunded',
  PART_REFUNDED:   'partially_refunded',
};

function normalizeStatus(rawStatus) {
  if (!rawStatus) return 'unknown';
  const upper = rawStatus.toUpperCase().replace(/[\s-]+/g, '_');
  const mapped = CJ_STATUS_MAP[upper];
  if (!mapped) {
    console.warn(`CJ: unmapped status — "${rawStatus}" — routing to dead-letter review`);
    return `unmapped:${rawStatus}`;
  }
  return mapped;
}

// ── Normalize CJ order response ────────────────────────────────────────────
function normalizeCJOrder(cjOrder) {
  const rawStatus = cjOrder.orderStatus || cjOrder.status || '';
  return {
    cj_order_id: cjOrder.orderId || cjOrder.id,
    cj_status_raw: rawStatus,
    canonical_status: normalizeStatus(rawStatus),
    tracking_number: cjOrder.trackNumber || cjOrder.trackingNumber || null,
    carrier: cjOrder.shippingCarrier || cjOrder.logisticName || null,
    tracking_url: cjOrder.trackingUrl || null,
    created_at: cjOrder.createTime || cjOrder.createdAt || null,
    shipping_time: cjOrder.shippingTime || null,
    line_items: (cjOrder.orderProductList || cjOrder.products || []).map(p => ({
      cj_product_id: p.pid || p.productId,
      cj_sku: p.vid || p.variantId || p.sku,
      quantity: p.quantity,
      unit_price: p.unitPrice || p.price,
    })),
  };
}

// ── Build CJ order payload from canonical order ────────────────────────────
function buildCJOrderPayload(canonicalOrder, variantMappings) {
  const products = canonicalOrder.line_items.map(li => {
    const mapping = variantMappings.find(m => m.canonical_id === li.canonical_variant_id);
    if (!mapping) {
      throw Object.assign(
        new Error(`No CJ mapping for canonical_variant_id: ${li.canonical_variant_id}`),
        { failureClass: 'product_mapping_failure' }
      );
    }
    return {
      vid: mapping.cj_id,
      quantity: li.quantity,
    };
  });

  const addr = canonicalOrder.shipping_address;
  return {
    orderNumber: canonicalOrder.canonical_order_id,
    shippingZip: addr.zip || addr.postal_code || '',
    shippingCountryCode: addr.country_code || addr.country || '',
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
}

// ── Main handler ───────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const email = Deno.env.get('CJ_EMAIL');
  const apiKey = Deno.env.get('CJ_API_KEY');
  if (!email || !apiKey) {
    return Response.json({ error: 'Missing CJ_EMAIL or CJ_API_KEY' }, { status: 500 });
  }

  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { action } = body;
  const corrId = body.correlation_id || `cj-order-${Date.now()}`;

  let token;
  try {
    token = await getCJToken(email, apiKey);
  } catch (e) {
    await base44.asServiceRole.entities.CJDeadLetter.create({
      operation: 'auth',
      failure_class: 'auth_failure',
      failure_reason: e.message,
      request_payload: JSON.stringify({ action }),
      status: 'pending_retry',
      correlation_id: corrId,
    });
    return Response.json({ error: 'CJ auth failed', detail: e.message, correlation_id: corrId }, { status: 502 });
  }

  // ── submit_order ───────────────────────────────────────────────────────
  if (action === 'submit_order') {
    const { order } = body;
    if (!order || !order.canonical_order_id) {
      return Response.json({ error: 'order.canonical_order_id required' }, { status: 400 });
    }

    // Idempotency — check existing mapping
    const existing = await base44.asServiceRole.entities.CJMapping.filter({
      entity_type: 'order',
      canonical_id: order.canonical_order_id,
    });
    if (existing.length > 0) {
      return Response.json({
        action, status: 'already_submitted',
        cj_order_id: existing[0].cj_id,
        cj_status: existing[0].cj_status_raw,
        canonical_status: existing[0].canonical_status,
        message: 'Order already submitted to CJ — use sync_fulfillment to update status',
        correlation_id: corrId,
      });
    }

    // Resolve variant mappings
    const variantMappings = [];
    for (const li of order.line_items) {
      const maps = await base44.asServiceRole.entities.CJMapping.filter({
        entity_type: 'variant',
        canonical_id: li.canonical_variant_id,
      });
      if (maps.length > 0) variantMappings.push(maps[0]);
    }

    let cjPayload;
    try {
      cjPayload = buildCJOrderPayload(order, variantMappings);
    } catch (e) {
      await base44.asServiceRole.entities.CJDeadLetter.create({
        operation: 'order_submit',
        failure_class: e.failureClass || 'product_mapping_failure',
        canonical_id: order.canonical_order_id,
        failure_reason: e.message,
        request_payload: JSON.stringify(order),
        status: 'pending_retry',
        correlation_id: corrId,
      });
      return Response.json({ error: 'Order build failed', detail: e.message, correlation_id: corrId }, { status: 400 });
    }

    let cjResult;
    try {
      cjResult = await cjPost(token, '/shopping/order/createOrder', cjPayload);
    } catch (e) {
      await base44.asServiceRole.entities.CJDeadLetter.create({
        operation: 'order_submit',
        failure_class: 'order_submission_failure',
        canonical_id: order.canonical_order_id,
        failure_reason: e.message,
        request_payload: JSON.stringify(cjPayload),
        cj_response_raw: e.cjMessage || '',
        status: 'pending_retry',
        retry_count: 0,
        correlation_id: corrId,
      });
      return Response.json({ error: 'CJ order submission failed', detail: e.message, correlation_id: corrId }, { status: 502 });
    }

    const cjOrderId = cjResult.orderId || cjResult.id || String(cjResult);
    await base44.asServiceRole.entities.CJMapping.create({
      entity_type: 'order',
      canonical_id: order.canonical_order_id,
      cj_id: cjOrderId,
      sync_status: 'synced',
      canonical_status: 'pending',
      cj_status_raw: 'CREATED',
      last_synced_at: new Date().toISOString(),
      metadata: {
        correlation_id: corrId,
        submitted_at: new Date().toISOString(),
        line_item_count: order.line_items.length,
      },
    });

    console.log('CJ order submitted', { canonical_order_id: order.canonical_order_id, cj_order_id: cjOrderId, correlation_id: corrId });
    return Response.json({ action, status: 'success', cj_order_id: cjOrderId, correlation_id: corrId });
  }

  // ── get_order_status ───────────────────────────────────────────────────
  if (action === 'get_order_status') {
    const { canonical_order_id, cj_order_id } = body;

    let cjId = cj_order_id;
    if (!cjId && canonical_order_id) {
      const maps = await base44.asServiceRole.entities.CJMapping.filter({
        entity_type: 'order',
        canonical_id: canonical_order_id,
      });
      if (maps.length === 0) return Response.json({ error: 'No CJ mapping found for this order' }, { status: 404 });
      cjId = maps[0].cj_id;
    }
    if (!cjId) return Response.json({ error: 'canonical_order_id or cj_order_id required' }, { status: 400 });

    let raw;
    try {
      raw = await cjGet(token, '/shopping/order/getOrderDetail', { orderId: cjId });
    } catch (e) {
      await base44.asServiceRole.entities.CJDeadLetter.create({
        operation: 'tracking_fetch',
        failure_class: 'tracking_retrieval_failure',
        cj_id: cjId,
        canonical_id: canonical_order_id || '',
        failure_reason: e.message,
        status: 'pending_retry',
        correlation_id: corrId,
      });
      return Response.json({ error: 'CJ order status fetch failed', detail: e.message }, { status: 502 });
    }

    const normalized = normalizeCJOrder(raw);
    return Response.json({ action, status: 'success', order: normalized, correlation_id: corrId });
  }

  // ── get_tracking ───────────────────────────────────────────────────────
  if (action === 'get_tracking') {
    const { canonical_order_id, cj_order_id } = body;

    let cjId = cj_order_id;
    if (!cjId && canonical_order_id) {
      const maps = await base44.asServiceRole.entities.CJMapping.filter({
        entity_type: 'order',
        canonical_id: canonical_order_id,
      });
      if (maps.length === 0) return Response.json({ error: 'No CJ mapping found for this order' }, { status: 404 });
      cjId = maps[0].cj_id;
    }
    if (!cjId) return Response.json({ error: 'canonical_order_id or cj_order_id required' }, { status: 400 });

    let trackData;
    try {
      trackData = await cjGet(token, '/logistic/trackInfo/getTrackInfo', { orderId: cjId });
    } catch (e) {
      await base44.asServiceRole.entities.CJDeadLetter.create({
        operation: 'tracking_fetch',
        failure_class: 'tracking_retrieval_failure',
        cj_id: cjId,
        canonical_id: canonical_order_id || '',
        failure_reason: e.message,
        status: 'pending_retry',
        correlation_id: corrId,
      });
      return Response.json({ error: 'CJ tracking fetch failed', detail: e.message }, { status: 502 });
    }

    const normalized = {
      cj_order_id: cjId,
      tracking_number: trackData.trackNumber || null,
      carrier: trackData.shippingCarrier || trackData.logisticName || null,
      tracking_url: trackData.trackingUrl || null,
      events: (trackData.trackList || trackData.events || []).map(e => ({
        timestamp: e.trackTime || e.time || null,
        location: e.trackLocation || e.location || null,
        description: e.trackContent || e.description || null,
      })),
      fetched_at: new Date().toISOString(),
    };

    // Persist tracking mapping
    const existingShipment = await base44.asServiceRole.entities.CJMapping.filter({
      entity_type: 'shipment',
      canonical_id: canonical_order_id || cjId,
    });
    if (existingShipment.length === 0 && normalized.tracking_number) {
      await base44.asServiceRole.entities.CJMapping.create({
        entity_type: 'shipment',
        canonical_id: canonical_order_id || `shipment_cj_${cjId}`,
        cj_id: cjId,
        sync_status: 'synced',
        last_synced_at: new Date().toISOString(),
        metadata: {
          tracking_number: normalized.tracking_number,
          carrier: normalized.carrier,
        },
      });
    } else if (existingShipment.length > 0) {
      await base44.asServiceRole.entities.CJMapping.update(existingShipment[0].id, {
        sync_status: 'synced',
        last_synced_at: new Date().toISOString(),
        metadata: { tracking_number: normalized.tracking_number, carrier: normalized.carrier },
      });
    }

    return Response.json({ action, status: 'success', tracking: normalized, correlation_id: corrId });
  }

  // ── sync_fulfillment ───────────────────────────────────────────────────
  if (action === 'sync_fulfillment') {
    const { canonical_order_id } = body;
    if (!canonical_order_id) return Response.json({ error: 'canonical_order_id required' }, { status: 400 });

    const maps = await base44.asServiceRole.entities.CJMapping.filter({
      entity_type: 'order',
      canonical_id: canonical_order_id,
    });
    if (maps.length === 0) {
      return Response.json({ error: 'No CJ order mapping found', canonical_order_id }, { status: 404 });
    }

    const orderMapping = maps[0];
    let raw;
    try {
      raw = await cjGet(token, '/shopping/order/getOrderDetail', { orderId: orderMapping.cj_id });
    } catch (e) {
      return Response.json({ error: 'CJ order detail fetch failed', detail: e.message }, { status: 502 });
    }

    const normalized = normalizeCJOrder(raw);
    const previousStatus = orderMapping.canonical_status;
    const statusChanged = previousStatus !== normalized.canonical_status;

    await base44.asServiceRole.entities.CJMapping.update(orderMapping.id, {
      sync_status: 'synced',
      canonical_status: normalized.canonical_status,
      cj_status_raw: normalized.cj_status_raw,
      last_synced_at: new Date().toISOString(),
      metadata: {
        ...orderMapping.metadata,
        tracking_number: normalized.tracking_number,
        carrier: normalized.carrier,
        last_cj_status: normalized.cj_status_raw,
      },
    });

    if (normalized.canonical_status.startsWith('unmapped:')) {
      await base44.asServiceRole.entities.CJDeadLetter.create({
        operation: 'tracking_fetch',
        failure_class: 'malformed_response',
        canonical_id: canonical_order_id,
        cj_id: orderMapping.cj_id,
        failure_reason: `Unmapped CJ status: ${normalized.cj_status_raw}`,
        cj_response_raw: normalized.cj_status_raw,
        status: 'pending_retry',
        correlation_id: corrId,
      });
    }

    console.log('CJ fulfillment synced', {
      canonical_order_id,
      cj_status: normalized.cj_status_raw,
      canonical_status: normalized.canonical_status,
      status_changed: statusChanged,
      correlation_id: corrId,
    });

    return Response.json({
      action, status: 'success',
      canonical_order_id,
      cj_order_id: orderMapping.cj_id,
      previous_status: previousStatus,
      current_status: normalized.canonical_status,
      cj_status_raw: normalized.cj_status_raw,
      status_changed: statusChanged,
      tracking_number: normalized.tracking_number,
      carrier: normalized.carrier,
      canonical_event: {
        event_type: 'commerce.fulfillment.updated',
        source: 'cj_adapter',
        canonical_order_id,
        cj_order_id: orderMapping.cj_id,
        status: normalized.canonical_status,
        tracking_number: normalized.tracking_number,
        carrier: normalized.carrier,
        updated_at: new Date().toISOString(),
      },
      correlation_id: corrId,
    });
  }

  // ── reconcile ──────────────────────────────────────────────────────────
  if (action === 'reconcile') {
    const report = {
      timestamp: new Date().toISOString(),
      correlation_id: corrId,
      checks: [],
    };

    // Get all order mappings
    const orderMappings = await base44.asServiceRole.entities.CJMapping.filter({ entity_type: 'order' });
    report.total_order_mappings = orderMappings.length;

    const driftDetected = [];
    const errors = [];

    for (const mapping of orderMappings) {
      try {
        const raw = await cjGet(token, '/shopping/order/getOrderDetail', { orderId: mapping.cj_id });
        const normalized = normalizeCJOrder(raw);

        if (normalized.canonical_status !== mapping.canonical_status) {
          driftDetected.push({
            canonical_id: mapping.canonical_id,
            cj_id: mapping.cj_id,
            stored_status: mapping.canonical_status,
            live_status: normalized.canonical_status,
            cj_status_raw: normalized.cj_status_raw,
          });
          // Mark as drift in mapping
          await base44.asServiceRole.entities.CJMapping.update(mapping.id, {
            sync_status: 'drift_detected',
            cj_status_raw: normalized.cj_status_raw,
          });
        }
      } catch (e) {
        errors.push({ canonical_id: mapping.canonical_id, cj_id: mapping.cj_id, error: e.message });
      }
    }

    report.drift_detected = driftDetected;
    report.drift_count = driftDetected.length;
    report.errors = errors;
    report.error_count = errors.length;

    // Dead-letter count
    const deadLetters = await base44.asServiceRole.entities.CJDeadLetter.filter({ status: 'pending_retry' });
    report.dead_letters_pending = deadLetters.length;

    console.log('CJ reconciliation complete', {
      total: orderMappings.length,
      drift: driftDetected.length,
      errors: errors.length,
      correlation_id: corrId,
    });

    return Response.json({ action, status: 'success', report });
  }

  return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
});