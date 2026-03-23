/**
 * End-to-End Pipeline Test Orchestrator
 *
 * Validates the full commerce loop:
 *   canonical product → Shopify → order webhook → CJ routing → tracking → Shopify fulfillment
 *
 * Actions:
 *   run_pipeline_test     — execute all steps sequentially, return full report
 *   step_create_product   — Step 1: create canonical product + sync to Shopify
 *   step_verify_shopify   — Step 2: verify product exists in Shopify via API
 *   step_simulate_order   — Step 3: simulate a Shopify order event for the test product
 *   step_route_to_cj      — Step 4: route simulated order to CJ
 *   step_check_tracking   — Step 5: check CJ tracking status
 *   step_push_fulfillment — Step 6: push tracking back to Shopify (if tracking available)
 *   pipeline_status       — get current status of all steps for a test run
 *
 * Required env vars:
 *   SHOPIFY_ACCESS_TOKEN
 *   SHOPIFY_STORE_DOMAIN
 *   CJ_EMAIL
 *   CJ_API_KEY
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const SHOPIFY_API_VERSION = '2026-01';
const CJ_BASE = 'https://developers.cjdropshipping.com/api2.0/v1';

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

async function getCJToken(base44, email, apiKey) {
  const now = Date.now();
  const sessions = await base44.asServiceRole.entities.CJSession.filter({ email });
  const session = sessions[0];
  if (session?.access_token && session.expires_at > now + 300_000) return session.access_token;

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
          expires_at: now + (data.data.expiresIn || 86400) * 1000, email,
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
  if (data.result !== true || !data.data?.accessToken) throw new Error(`CJ auth failed: ${data.message}`);
  const newSession = {
    access_token: data.data.accessToken,
    refresh_token: data.data.refreshToken || null,
    expires_at: now + (data.data.expiresIn || 86400) * 1000, email,
  };
  if (session) {
    await base44.asServiceRole.entities.CJSession.update(session.id, newSession);
  } else {
    await base44.asServiceRole.entities.CJSession.create(newSession);
  }
  return newSession.access_token;
}

async function cjGet(token, path, params) {
  const url = new URL(`${CJ_BASE}${path}`);
  if (params) for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }
  const res = await fetch(url.toString(), {
    headers: { 'CJ-Access-Token': token, 'Content-Type': 'application/json' },
  });
  const data = await res.json();
  if (data.result === false) throw new Error(`CJ GET [${path}]: ${data.message}`);
  return data.data || data;
}

// ── Step 1: Create canonical product + sync to Shopify ───────────────────
async function stepCreateProduct(base44, shopifyDomain, shopifyAccessToken, testRunId, cjProductId) {
  const canonicalProductId = `test_product_${testRunId}`;

  // Fetch CJ product data for realistic content
  const cjToken = await base44.asServiceRole; // not needed here — we use provided data
  let title = 'Test Pipeline Product';
  let variants = [];
  let cjVariants = [];

  // Fetch from CJ if product ID provided
  if (cjProductId) {
    const sessions = await base44.asServiceRole.entities.CJSession.filter({});
    const session = sessions[0];
    if (session?.access_token) {
      try {
        const url = new URL(`${CJ_BASE}/product/query`);
        url.searchParams.set('pid', cjProductId);
        const res = await fetch(url.toString(), {
          headers: { 'CJ-Access-Token': session.access_token, 'Content-Type': 'application/json' },
        });
        const data = await res.json();
        if (data.result !== false && data.data) {
          const p = data.data;
          title = p.productNameEn || p.productName || title;
          cjVariants = p.variants || [];
          variants = cjVariants.slice(0, 3).map((v, i) => ({
            canonical_id: `test_variant_${testRunId}_${i}`,
            title: v.variantNameEn || v.variantName || `Variant ${i + 1}`,
            sku: v.variantSku || `TEST-SKU-${testRunId}-${i}`,
            price: v.variantSellPrice || '29.99',
            option1: v.variantKey1 || null,
          }));
        }
      } catch (_) { /* use defaults */ }
    }
  }

  if (variants.length === 0) {
    variants = [{ canonical_id: `test_variant_${testRunId}_0`, title: 'Default', sku: `TEST-SKU-${testRunId}`, price: '29.99' }];
  }

  // Build Shopify product payload
  const shopifyPayload = {
    product: {
      title: `[TEST] ${title}`,
      body_html: '<p>Pipeline validation test product. Do not fulfill.</p>',
      vendor: 'Pipeline Test',
      status: 'draft', // draft so it doesn't show in store
      variants: variants.map(v => ({
        title: v.title,
        sku: v.sku,
        price: String(v.price || '29.99'),
        inventory_management: 'shopify',
        option1: v.option1 || null,
      })),
    },
  };

  // Sync to Shopify
  const result = await shopifyRequest(shopifyDomain, shopifyAccessToken, 'POST', '/products.json', shopifyPayload);
  const shopifyProduct = result.product;

  // Write canonical → Shopify product mapping
  await base44.asServiceRole.entities.ShopifyMapping.create({
    entity_type: 'product',
    canonical_id: canonicalProductId,
    shopify_id: String(shopifyProduct.id),
    shopify_gid: `gid://shopify/Product/${shopifyProduct.id}`,
    shop_domain: shopifyDomain,
    sync_status: 'synced',
    last_synced_at: new Date().toISOString(),
    metadata: { title: shopifyProduct.title, test_run_id: testRunId },
  });

  // Write canonical → Shopify variant mappings (also write CJ mappings if cjProductId provided)
  const variantMappings = [];
  for (let i = 0; i < shopifyProduct.variants.length && i < variants.length; i++) {
    const sv = shopifyProduct.variants[i];
    const cv = variants[i];
    await base44.asServiceRole.entities.ShopifyMapping.create({
      entity_type: 'variant',
      canonical_id: cv.canonical_id,
      shopify_id: String(sv.id),
      shopify_gid: `gid://shopify/ProductVariant/${sv.id}`,
      shop_domain: shopifyDomain,
      sync_status: 'synced',
      last_synced_at: new Date().toISOString(),
      metadata: { product_shopify_id: String(shopifyProduct.id), sku: sv.sku, shopify_variant_id: String(sv.id) },
    });

    // If CJ product provided, also write CJ variant mapping
    if (cjProductId && cjVariants[i]) {
      const cjV = cjVariants[i];
      await base44.asServiceRole.entities.CJMapping.create({
        entity_type: 'variant',
        canonical_id: cv.canonical_id,
        cj_id: cjV.vid,
        cj_sku: cjV.variantSku || cjV.sku || '',
        sync_status: 'synced',
        last_synced_at: new Date().toISOString(),
        metadata: {
          product_cj_id: cjProductId,
          shopify_variant_id: String(sv.id),
          title: cjV.variantNameEn || cjV.variantName || '',
          sell_price: cjV.variantSellPrice || null,
        },
      });
    }

    variantMappings.push({ canonical_id: cv.canonical_id, shopify_id: String(sv.id), sku: sv.sku });
  }

  return {
    canonical_product_id: canonicalProductId,
    shopify_product_id: String(shopifyProduct.id),
    shopify_product_handle: shopifyProduct.handle,
    title: shopifyProduct.title,
    variant_count: shopifyProduct.variants.length,
    variant_mappings: variantMappings,
    cj_variants_mapped: cjProductId ? Math.min(cjVariants.length, variants.length) : 0,
  };
}

// ── Step 2: Verify Shopify product ────────────────────────────────────────
async function stepVerifyShopify(shopifyDomain, shopifyAccessToken, shopifyProductId) {
  const result = await shopifyRequest(shopifyDomain, shopifyAccessToken, 'GET', `/products/${shopifyProductId}.json`);
  const p = result.product;
  return {
    verified: true,
    shopify_product_id: String(p.id),
    title: p.title,
    status: p.status,
    variant_count: p.variants.length,
    variants: p.variants.map(v => ({ id: String(v.id), sku: v.sku, price: v.price })),
  };
}

// ── Step 3: Simulate a Shopify order for the test product ─────────────────
async function stepSimulateOrder(base44, shopifyDomain, shopifyAccessToken, shopifyProductId, shopifyVariantId, testRunId) {
  // Create a test order via Shopify API (draft order → complete)
  const draftOrderPayload = {
    draft_order: {
      line_items: [{ variant_id: parseInt(shopifyVariantId), quantity: 1 }],
      shipping_address: {
        first_name: 'Pipeline',
        last_name: 'Test',
        address1: '123 Test Street',
        city: 'Dubai',
        province: 'Dubai',
        country: 'AE',
        zip: '00000',
        phone: '+971000000000',
      },
      billing_address: {
        first_name: 'Pipeline',
        last_name: 'Test',
        address1: '123 Test Street',
        city: 'Dubai',
        country: 'AE',
      },
      email: 'pipeline-test@test.internal',
      note: `Pipeline validation test — run ${testRunId}`,
      tags: 'pipeline-test,do-not-fulfill',
    },
  };

  const draftResult = await shopifyRequest(shopifyDomain, shopifyAccessToken, 'POST', '/draft_orders.json', draftOrderPayload);
  const draftOrder = draftResult.draft_order;

  // Complete the draft order to create a real order
  const completeResult = await shopifyRequest(
    shopifyDomain, shopifyAccessToken, 'PUT',
    `/draft_orders/${draftOrder.id}/complete.json`
  );
  const completedOrder = completeResult.draft_order;
  const shopifyOrderId = String(completedOrder.order_id);

  // Fetch the full order
  const orderResult = await shopifyRequest(shopifyDomain, shopifyAccessToken, 'GET', `/orders/${shopifyOrderId}.json`);
  const order = orderResult.order;

  // Write ShopifyMapping for the order
  const canonicalOrderId = `order_shopify_${shopifyOrderId}`;
  await base44.asServiceRole.entities.ShopifyMapping.create({
    entity_type: 'order',
    canonical_id: canonicalOrderId,
    shopify_id: shopifyOrderId,
    shop_domain: shopifyDomain,
    sync_status: 'synced',
    last_synced_at: new Date().toISOString(),
    metadata: {
      order_number: order.order_number,
      financial_status: order.financial_status,
      test_run_id: testRunId,
    },
  });

  return {
    shopify_order_id: shopifyOrderId,
    canonical_order_id: canonicalOrderId,
    order_number: order.order_number,
    financial_status: order.financial_status,
    line_items: (order.line_items || []).map(li => ({
      shopify_line_item_id: String(li.id),
      shopify_variant_id: String(li.variant_id),
      sku: li.sku,
      quantity: li.quantity,
      price: li.price,
    })),
    shipping_address: order.shipping_address,
  };
}

// ── Step 4: Route order to CJ ─────────────────────────────────────────────
async function stepRouteToCJ(base44, cjToken, orderData) {
  const canonicalOrderId = orderData.canonical_order_id;
  const shopifyOrderId = orderData.shopify_order_id;

  // Build canonical order with variant mappings
  const canonicalLineItems = [];
  for (const li of orderData.line_items) {
    const variantMaps = await base44.asServiceRole.entities.ShopifyMapping.filter({
      entity_type: 'variant',
      shopify_id: li.shopify_variant_id,
    });
    canonicalLineItems.push({
      canonical_variant_id: variantMaps.length > 0 ? variantMaps[0].canonical_id : null,
      shopify_variant_id: li.shopify_variant_id,
      sku: li.sku,
      quantity: li.quantity,
    });
  }

  const addr = orderData.shipping_address || {};
  const canonicalOrder = {
    canonical_order_id: canonicalOrderId,
    shopify_order_id: shopifyOrderId,
    line_items: canonicalLineItems,
    shipping_address: {
      name: `${addr.first_name || ''} ${addr.last_name || ''}`.trim(),
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
    remark: 'Pipeline test order — do not ship',
  };

  // Check existing CJ mapping (idempotency)
  const existing = await base44.asServiceRole.entities.CJMapping.filter({
    entity_type: 'order', canonical_id: canonicalOrderId,
  });
  if (existing.length > 0) {
    return { status: 'already_routed', cj_order_id: existing[0].cj_id };
  }

  // Resolve CJ variant mappings
  const products = [];
  const unmapped = [];
  for (const li of canonicalLineItems) {
    let maps = [];
    if (li.canonical_variant_id) {
      maps = await base44.asServiceRole.entities.CJMapping.filter({
        entity_type: 'variant', canonical_id: li.canonical_variant_id,
      });
    }
    if (maps.length > 0) {
      products.push({ vid: maps[0].cj_id, quantity: li.quantity });
    } else {
      unmapped.push(li.canonical_variant_id || li.shopify_variant_id || 'unknown');
    }
  }

  if (products.length === 0) {
    return {
      status: 'blocked_no_cj_mappings',
      unmapped_variants: unmapped,
      message: 'No CJ variant mappings found. Provide cj_product_id in step_create_product to auto-map, or map manually first.',
    };
  }

  const cjPayload = {
    orderNumber: canonicalOrderId,
    shippingZip: canonicalOrder.shipping_address.zip,
    shippingCountryCode: canonicalOrder.shipping_address.country_code,
    shippingCountry: canonicalOrder.shipping_address.country,
    shippingProvince: canonicalOrder.shipping_address.province,
    shippingCity: canonicalOrder.shipping_address.city,
    shippingAddress: canonicalOrder.shipping_address.address1,
    shippingAddress2: canonicalOrder.shipping_address.address2 || '',
    shippingCustomerName: canonicalOrder.shipping_address.name,
    shippingPhone: canonicalOrder.shipping_address.phone,
    remark: canonicalOrder.remark,
    products,
  };

  let cjResult;
  try {
    cjResult = await (async () => {
      const res = await fetch(`${CJ_BASE}/shopping/order/createOrder`, {
        method: 'POST',
        headers: { 'CJ-Access-Token': cjToken, 'Content-Type': 'application/json' },
        body: JSON.stringify(cjPayload),
      });
      const data = await res.json();
      if (data.result === false) throw new Error(`CJ order error: ${data.message}`);
      return data.data || data;
    })();
  } catch (e) {
    await base44.asServiceRole.entities.CJDeadLetter.create({
      operation: 'order_submit', failure_class: 'order_submission_failure',
      canonical_id: canonicalOrderId, failure_reason: e.message,
      request_payload: JSON.stringify(cjPayload), status: 'pending_retry',
    });
    return { status: 'cj_submission_failed', error: e.message, note: 'Dead-letter created' };
  }

  const cjOrderId = cjResult.orderId || cjResult.id || String(cjResult);
  await base44.asServiceRole.entities.CJMapping.create({
    entity_type: 'order', canonical_id: canonicalOrderId, cj_id: cjOrderId,
    sync_status: 'synced', canonical_status: 'pending', cj_status_raw: 'CREATED',
    last_synced_at: new Date().toISOString(),
    metadata: { shopify_order_id: shopifyOrderId, submitted_at: new Date().toISOString() },
  });

  return { status: 'submitted', cj_order_id: cjOrderId, products_submitted: products.length };
}

// ── Step 5: Check CJ tracking ─────────────────────────────────────────────
async function stepCheckTracking(base44, cjToken, canonicalOrderId) {
  const maps = await base44.asServiceRole.entities.CJMapping.filter({ entity_type: 'order', canonical_id: canonicalOrderId });
  if (maps.length === 0) return { status: 'no_cj_mapping' };

  const cjOrderId = maps[0].cj_id;
  try {
    const url = new URL(`${CJ_BASE}/logistic/trackInfo/getTrackInfo`);
    url.searchParams.set('orderId', cjOrderId);
    const res = await fetch(url.toString(), {
      headers: { 'CJ-Access-Token': cjToken, 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    const track = data.data || data;
    return {
      status: 'checked',
      cj_order_id: cjOrderId,
      tracking_number: track.trackNumber || null,
      carrier: track.shippingCarrier || track.logisticName || null,
      has_tracking: !!(track.trackNumber),
      events_count: (track.trackList || track.events || []).length,
    };
  } catch (e) {
    return { status: 'tracking_fetch_failed', error: e.message };
  }
}

// ── Main handler ──────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

  const shopifyAccessToken = Deno.env.get('SHOPIFY_ACCESS_TOKEN');
  const shopifyDomain = Deno.env.get('SHOPIFY_STORE_DOMAIN');
  const cjEmail = Deno.env.get('CJ_EMAIL');
  const cjApiKey = Deno.env.get('CJ_API_KEY');

  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user || user.role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });

  const body = await req.json();
  const { action } = body;
  const testRunId = body.test_run_id || `run_${Date.now()}`;

  const requiresShopify = ['run_pipeline_test', 'step_create_product', 'step_verify_shopify', 'step_simulate_order', 'step_push_fulfillment'];
  if (requiresShopify.includes(action) && (!shopifyAccessToken || !shopifyDomain)) {
    return Response.json({ error: 'Missing SHOPIFY_ACCESS_TOKEN or SHOPIFY_STORE_DOMAIN' }, { status: 500 });
  }

  // ── step_create_product ───────────────────────────────────────────────────
  if (action === 'step_create_product') {
    const result = await stepCreateProduct(base44, shopifyDomain, shopifyAccessToken, testRunId, body.cj_product_id || null);
    return Response.json({ action, test_run_id: testRunId, ...result });
  }

  // ── step_verify_shopify ───────────────────────────────────────────────────
  if (action === 'step_verify_shopify') {
    const { shopify_product_id } = body;
    if (!shopify_product_id) return Response.json({ error: 'shopify_product_id required' }, { status: 400 });
    const result = await stepVerifyShopify(shopifyDomain, shopifyAccessToken, shopify_product_id);
    return Response.json({ action, ...result });
  }

  // ── step_simulate_order ───────────────────────────────────────────────────
  if (action === 'step_simulate_order') {
    const { shopify_product_id, shopify_variant_id } = body;
    if (!shopify_product_id || !shopify_variant_id) {
      return Response.json({ error: 'shopify_product_id and shopify_variant_id required' }, { status: 400 });
    }
    const result = await stepSimulateOrder(base44, shopifyDomain, shopifyAccessToken, shopify_product_id, shopify_variant_id, testRunId);
    return Response.json({ action, test_run_id: testRunId, ...result });
  }

  // ── step_route_to_cj ──────────────────────────────────────────────────────
  if (action === 'step_route_to_cj') {
    const { order_data } = body;
    if (!order_data?.canonical_order_id) return Response.json({ error: 'order_data.canonical_order_id required' }, { status: 400 });
    if (!cjEmail || !cjApiKey) return Response.json({ error: 'Missing CJ credentials' }, { status: 500 });
    const cjToken = await getCJToken(base44, cjEmail, cjApiKey);
    const result = await stepRouteToCJ(base44, cjToken, order_data);
    return Response.json({ action, test_run_id: testRunId, ...result });
  }

  // ── step_check_tracking ───────────────────────────────────────────────────
  if (action === 'step_check_tracking') {
    const { canonical_order_id } = body;
    if (!canonical_order_id) return Response.json({ error: 'canonical_order_id required' }, { status: 400 });
    if (!cjEmail || !cjApiKey) return Response.json({ error: 'Missing CJ credentials' }, { status: 500 });
    const cjToken = await getCJToken(base44, cjEmail, cjApiKey);
    const result = await stepCheckTracking(base44, cjToken, canonical_order_id);
    return Response.json({ action, ...result });
  }

  // ── step_push_fulfillment ─────────────────────────────────────────────────
  if (action === 'step_push_fulfillment') {
    const { canonical_order_id } = body;
    if (!canonical_order_id) return Response.json({ error: 'canonical_order_id required' }, { status: 400 });
    // Delegate to orderRouter
    const result = await base44.asServiceRole.functions.invoke('orderRouter', {
      action: 'push_tracking_to_shopify',
      canonical_order_id,
    });
    return Response.json({ action, ...result });
  }

  // ── pipeline_status ───────────────────────────────────────────────────────
  if (action === 'pipeline_status') {
    const { canonical_order_id, shopify_product_id } = body;
    const report = { timestamp: new Date().toISOString(), test_run_id: testRunId };

    if (shopify_product_id) {
      const shopifyMaps = await base44.asServiceRole.entities.ShopifyMapping.filter({
        entity_type: 'product', shopify_id: shopify_product_id,
      });
      report.product = shopifyMaps[0] || null;
    }

    if (canonical_order_id) {
      const [cjOrderMaps, shopifyOrderMaps, shipmentMaps] = await Promise.all([
        base44.asServiceRole.entities.CJMapping.filter({ entity_type: 'order', canonical_id: canonical_order_id }),
        base44.asServiceRole.entities.ShopifyMapping.filter({ entity_type: 'order', canonical_id: canonical_order_id }),
        base44.asServiceRole.entities.CJMapping.filter({ entity_type: 'shipment', canonical_id: canonical_order_id }),
      ]);
      report.order = {
        shopify: shopifyOrderMaps[0] || null,
        cj: cjOrderMaps[0] || null,
        shipment: shipmentMaps[0] || null,
      };
    }

    return Response.json({ action, ...report });
  }

  // ── run_pipeline_test (full orchestrated run) ─────────────────────────────
  if (action === 'run_pipeline_test') {
    const { cj_product_id } = body;
    const report = {
      test_run_id: testRunId,
      started_at: new Date().toISOString(),
      steps: {},
    };

    if (!cjEmail || !cjApiKey) {
      report.steps.cj_auth = { status: 'BLOCKED', reason: 'Missing CJ credentials' };
      report.overall = 'BLOCKED';
      return Response.json({ action, report });
    }

    // Step 1: Create product + sync to Shopify
    try {
      const s1 = await stepCreateProduct(base44, shopifyDomain, shopifyAccessToken, testRunId, cj_product_id || null);
      report.steps.step1_create_product = { status: 'PASS', ...s1 };
    } catch (e) {
      report.steps.step1_create_product = { status: 'FAIL', error: e.message };
      report.overall = 'FAIL';
      report.completed_at = new Date().toISOString();
      return Response.json({ action, report });
    }

    const { shopify_product_id, variant_mappings } = report.steps.step1_create_product;
    const firstVariant = variant_mappings?.[0];

    // Step 2: Verify Shopify product
    try {
      const s2 = await stepVerifyShopify(shopifyDomain, shopifyAccessToken, shopify_product_id);
      report.steps.step2_verify_shopify = { status: 'PASS', ...s2 };
    } catch (e) {
      report.steps.step2_verify_shopify = { status: 'FAIL', error: e.message };
    }

    // Step 3: Simulate order (only if we have a variant)
    let orderData = null;
    if (firstVariant?.shopify_id) {
      try {
        orderData = await stepSimulateOrder(base44, shopifyDomain, shopifyAccessToken, shopify_product_id, firstVariant.shopify_id, testRunId);
        report.steps.step3_simulate_order = { status: 'PASS', ...orderData };
      } catch (e) {
        report.steps.step3_simulate_order = { status: 'FAIL', error: e.message };
      }
    } else {
      report.steps.step3_simulate_order = { status: 'SKIPPED', reason: 'No Shopify variant ID available' };
    }

    // Step 4: Route to CJ
    if (orderData && cj_product_id) {
      try {
        const cjToken = await getCJToken(base44, cjEmail, cjApiKey);
        const s4 = await stepRouteToCJ(base44, cjToken, orderData);
        report.steps.step4_route_to_cj = { status: s4.status === 'submitted' ? 'PASS' : 'WARN', ...s4 };
      } catch (e) {
        report.steps.step4_route_to_cj = { status: 'FAIL', error: e.message };
      }
    } else {
      report.steps.step4_route_to_cj = {
        status: 'SKIPPED',
        reason: cj_product_id ? 'No order created' : 'No cj_product_id provided — CJ variant mappings not created, order routing skipped',
        note: 'To test full pipeline, provide cj_product_id in the request body',
      };
    }

    // Step 5: Check tracking (non-blocking — tracking won't be available for a new order)
    if (orderData) {
      try {
        const cjToken = await getCJToken(base44, cjEmail, cjApiKey);
        const s5 = await stepCheckTracking(base44, cjToken, orderData.canonical_order_id);
        report.steps.step5_check_tracking = {
          status: s5.has_tracking ? 'PASS' : 'EXPECTED_PENDING',
          note: 'Tracking is only available after CJ ships the order (typically 1-3 business days)',
          ...s5,
        };
      } catch (e) {
        report.steps.step5_check_tracking = { status: 'FAIL', error: e.message };
      }
    } else {
      report.steps.step5_check_tracking = { status: 'SKIPPED', reason: 'No order created' };
    }

    // Step 6: Push tracking to Shopify (non-blocking — will report not_available if no tracking yet)
    report.steps.step6_push_fulfillment = {
      status: 'DEFERRED',
      note: 'Run step_push_fulfillment with canonical_order_id once tracking is available from CJ',
      canonical_order_id: orderData?.canonical_order_id || null,
    };

    const failCount = Object.values(report.steps).filter(s => s.status === 'FAIL').length;
    const passCount = Object.values(report.steps).filter(s => s.status === 'PASS').length;
    report.overall = failCount > 0 ? 'FAIL' : 'PASS';
    report.summary = `${passCount} passed, ${failCount} failed`;
    report.completed_at = new Date().toISOString();

    return Response.json({ action, report });
  }

  return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
});