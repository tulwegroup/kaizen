/**
 * CJ Dropshipping — Product Lookup & Supplier Data Sync
 *
 * Actions:
 *   lookup_product       — fetch + normalize a single CJ product by CJ product ID
 *   search_products      — search CJ catalog
 *   map_product          — persist canonical ↔ CJ mapping for a product + variants
 *   get_mapping          — retrieve existing mapping
 *   validate             — authenticated connectivity + test product lookup
 *
 * Required env vars:
 *   CJ_EMAIL             — CJdropshipping account email
 *   CJ_API_KEY           — CJdropshipping API key / password
 *
 * CJ API v2 base: https://developers.cjdropshipping.com/api2.0/v1
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const CJ_BASE = 'https://developers.cjdropshipping.com/api2.0/v1';

// ── Module-level token cache (per Deno isolate lifetime) ───────────────────
let _tokenCache = { token: null, expiresAt: 0, refreshToken: null };

async function getCJToken(email, apiKey) {
  const now = Date.now();
  // Reuse if still valid with 5-min safety buffer
  if (_tokenCache.token && _tokenCache.expiresAt > now + 300_000) {
    return _tokenCache.token;
  }

  // Attempt refresh if we have a refresh token
  if (_tokenCache.refreshToken && _tokenCache.expiresAt > now - 3_600_000) {
    try {
      const res = await fetch(`${CJ_BASE}/authentication/refreshAccessToken`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'refreshToken': _tokenCache.refreshToken,
        },
      });
      const data = await res.json();
      if (data.result === true && data.data?.accessToken) {
        _tokenCache = {
          token: data.data.accessToken,
          refreshToken: data.data.refreshToken || _tokenCache.refreshToken,
          expiresAt: now + (data.data.expiresIn || 86400) * 1000,
        };
        console.log('CJ token refreshed successfully');
        return _tokenCache.token;
      }
    } catch (_) {
      // Fall through to re-auth
    }
  }

  // Full re-authentication
  const res = await fetch(`${CJ_BASE}/authentication/getAccessToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: apiKey }),
  });

  const data = await res.json();
  if (data.result !== true || !data.data?.accessToken) {
    throw Object.assign(new Error(`CJ auth failed: ${data.message || JSON.stringify(data)}`), {
      failureClass: 'auth_failure',
    });
  }

  _tokenCache = {
    token: data.data.accessToken,
    refreshToken: data.data.refreshToken || null,
    expiresAt: now + (data.data.expiresIn || 86400) * 1000,
  };
  console.log('CJ authenticated successfully');
  return _tokenCache.token;
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
    const err = new Error(`CJ API error [${path}]: ${data.message || JSON.stringify(data)}`);
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
  const upper = rawStatus.toUpperCase().replace(/\s+/g, '_');
  const mapped = CJ_STATUS_MAP[upper];
  if (!mapped) {
    console.warn(`CJ: unmapped status encountered — ${rawStatus}`);
    return `unmapped:${rawStatus}`;
  }
  return mapped;
}

// ── Product normalization ──────────────────────────────────────────────────
function normalizeProduct(cjProduct) {
  return {
    cj_product_id: cjProduct.pid,
    title: cjProduct.productNameEn || cjProduct.productName || '',
    description: cjProduct.description || '',
    category_name: cjProduct.categoryName || '',
    supplier_name: cjProduct.supplierName || 'CJdropshipping',
    image_url: cjProduct.productImage || (cjProduct.productImages?.[0]) || '',
    images: cjProduct.productImages || [],
    weight: cjProduct.productWeight || null,
    weight_unit: 'g',
    sell_price: cjProduct.sellPrice || null,
    suggest_sell_price: cjProduct.suggestSellPrice || null,
    sourcing_available: cjProduct.sourcingAvailable !== false,
    variants: (cjProduct.variants || []).map(v => ({
      cj_variant_id: v.vid,
      cj_sku: v.variantSku || v.sku || '',
      title: v.variantNameEn || v.variantName || '',
      image: v.variantImage || '',
      sell_price: v.variantSellPrice || v.sellPrice || null,
      unit_weight: v.variantWeight || null,
      inventory: v.variantStock ?? null,
      option1: v.variantKey1 || null,
      option2: v.variantKey2 || null,
    })),
    shipping_info: cjProduct.shippingInfo || null,
    processing_time: cjProduct.processingTime || null,
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
  const { action, correlation_id } = body;
  const corrId = correlation_id || `cj-${Date.now()}`;

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
    return Response.json({ error: 'CJ authentication failed', detail: e.message, correlation_id: corrId }, { status: 502 });
  }

  // ── lookup_product ─────────────────────────────────────────────────────
  if (action === 'lookup_product') {
    const { cj_product_id } = body;
    if (!cj_product_id) return Response.json({ error: 'cj_product_id required' }, { status: 400 });

    let raw;
    try {
      raw = await cjGet(token, '/product/query', { pid: cj_product_id });
    } catch (e) {
      await base44.asServiceRole.entities.CJDeadLetter.create({
        operation: 'product_lookup',
        failure_class: 'product_mapping_failure',
        cj_id: cj_product_id,
        failure_reason: e.message,
        request_payload: JSON.stringify({ cj_product_id }),
        cj_response_raw: e.cjMessage || '',
        status: 'pending_retry',
        correlation_id: corrId,
      });
      return Response.json({ error: 'CJ product lookup failed', detail: e.message, correlation_id: corrId }, { status: 502 });
    }

    const normalized = normalizeProduct(raw);
    console.log('CJ product lookup success', { cj_product_id, title: normalized.title, correlation_id: corrId });
    return Response.json({ action, status: 'success', product: normalized, correlation_id: corrId });
  }

  // ── search_products ────────────────────────────────────────────────────
  if (action === 'search_products') {
    const { keyword, category_id, page = 1, page_size = 20 } = body;
    const params = { pageNum: page, pageSize: page_size };
    if (keyword) params.productNameEn = keyword;
    if (category_id) params.categoryId = category_id;

    let raw;
    try {
      raw = await cjGet(token, '/product/list', params);
    } catch (e) {
      return Response.json({ error: 'CJ product search failed', detail: e.message }, { status: 502 });
    }

    const products = (raw.list || raw || []).map(normalizeProduct);
    return Response.json({ action, status: 'success', total: raw.total || products.length, products, correlation_id: corrId });
  }

  // ── map_product ────────────────────────────────────────────────────────
  if (action === 'map_product') {
    const { canonical_product_id, cj_product_id, canonical_variants } = body;
    if (!canonical_product_id || !cj_product_id) {
      return Response.json({ error: 'canonical_product_id and cj_product_id required' }, { status: 400 });
    }

    // Fetch live CJ product to get variant IDs
    let cjProduct;
    try {
      const raw = await cjGet(token, '/product/query', { pid: cj_product_id });
      cjProduct = normalizeProduct(raw);
    } catch (e) {
      return Response.json({ error: 'CJ product fetch failed during mapping', detail: e.message }, { status: 502 });
    }

    // Idempotent product mapping
    const existingProduct = await base44.asServiceRole.entities.CJMapping.filter({
      entity_type: 'product',
      canonical_id: canonical_product_id,
    });

    let productMappingId;
    if (existingProduct.length === 0) {
      const created = await base44.asServiceRole.entities.CJMapping.create({
        entity_type: 'product',
        canonical_id: canonical_product_id,
        cj_id: cj_product_id,
        sync_status: 'synced',
        last_synced_at: new Date().toISOString(),
        metadata: { title: cjProduct.title, image_url: cjProduct.image_url },
      });
      productMappingId = created.id;
    } else {
      productMappingId = existingProduct[0].id;
      await base44.asServiceRole.entities.CJMapping.update(productMappingId, {
        sync_status: 'synced',
        last_synced_at: new Date().toISOString(),
      });
    }

    // Map variants if provided
    const variantResults = [];
    if (canonical_variants && Array.isArray(canonical_variants)) {
      for (const cv of canonical_variants) {
        const matchedCJVariant = cjProduct.variants.find(
          v => v.cj_sku === cv.cj_sku || v.cj_variant_id === cv.cj_variant_id
        );
        if (!matchedCJVariant) {
          variantResults.push({ canonical_variant_id: cv.canonical_variant_id, status: 'no_cj_match', cj_sku: cv.cj_sku });
          continue;
        }

        const existingVariant = await base44.asServiceRole.entities.CJMapping.filter({
          entity_type: 'variant',
          canonical_id: cv.canonical_variant_id,
        });

        if (existingVariant.length === 0) {
          await base44.asServiceRole.entities.CJMapping.create({
            entity_type: 'variant',
            canonical_id: cv.canonical_variant_id,
            cj_id: matchedCJVariant.cj_variant_id,
            cj_sku: matchedCJVariant.cj_sku,
            sync_status: 'synced',
            last_synced_at: new Date().toISOString(),
            metadata: {
              product_cj_id: cj_product_id,
              sell_price: matchedCJVariant.sell_price,
              title: matchedCJVariant.title,
            },
          });
        }
        variantResults.push({
          canonical_variant_id: cv.canonical_variant_id,
          cj_variant_id: matchedCJVariant.cj_variant_id,
          cj_sku: matchedCJVariant.cj_sku,
          status: 'mapped',
        });
      }
    }

    return Response.json({
      action, status: 'success',
      product_mapping: { canonical_product_id, cj_product_id, mapping_id: productMappingId },
      variant_mappings: variantResults,
      correlation_id: corrId,
    });
  }

  // ── get_mapping ────────────────────────────────────────────────────────
  if (action === 'get_mapping') {
    const { entity_type, canonical_id } = body;
    if (!entity_type || !canonical_id) {
      return Response.json({ error: 'entity_type and canonical_id required' }, { status: 400 });
    }
    const mappings = await base44.asServiceRole.entities.CJMapping.filter({ entity_type, canonical_id });
    return Response.json({ action, mapping: mappings[0] || null, correlation_id: corrId });
  }

  // ── validate ───────────────────────────────────────────────────────────
  if (action === 'validate') {
    const { test_cj_product_id } = body;
    const report = { timestamp: new Date().toISOString(), correlation_id: corrId };

    // Auth already confirmed above
    report.auth = { status: 'success', message: 'Token acquired' };

    if (test_cj_product_id) {
      try {
        const raw = await cjGet(token, '/product/query', { pid: test_cj_product_id });
        const normalized = normalizeProduct(raw);
        report.product_lookup = {
          status: 'success',
          cj_product_id: test_cj_product_id,
          title: normalized.title,
          variant_count: normalized.variants.length,
          first_variant_sku: normalized.variants[0]?.cj_sku || 'none',
        };
      } catch (e) {
        report.product_lookup = { status: 'failed', error: e.message };
      }
    } else {
      report.product_lookup = { status: 'skipped', reason: 'no test_cj_product_id provided' };
    }

    const mappingCount = await base44.asServiceRole.entities.CJMapping.filter({});
    report.mappings = { total: mappingCount.length };

    const deadLetterCount = await base44.asServiceRole.entities.CJDeadLetter.filter({ status: 'pending_retry' });
    report.dead_letters = { pending_retry: deadLetterCount.length };

    return Response.json({ action, report });
  }

  return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
});