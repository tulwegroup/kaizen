/**
 * Product Pipeline Test — Phase 1 Validation
 * Creates a test product, maps to CJ, syncs to Shopify, verifies end-to-end.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const CJ_BASE = 'https://developers.cjdropshipping.com/api2.0/v1';

async function getCJToken(base44, email, apiKey) {
  const now = Date.now();
  const sessions = await base44.asServiceRole.entities.CJSession.filter({ email });
  const session = sessions[0];

  if (session?.access_token && session.expires_at > now + 300_000) {
    return session.access_token;
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

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user || user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

  const { action, cj_product_id, cj_sku } = await req.json();

  // ── Phase 1: Create canonical test product ─────────────────────────────
  if (action === 'create_test_product') {
    const testProduct = {
      canonical_id: `test_product_${Date.now()}`,
      title: 'Test Product — Phase 1 Validation',
      description: 'This is a test product for pipeline validation',
      brand: 'TestBrand',
      product_type: 'dropship',
      vendor: 'CJ Dropshipping',
      variants: [
        {
          canonical_id: `test_variant_${Date.now()}_1`,
          title: 'Default',
          sku: `TEST-SKU-${Date.now()}`,
          price: 29.99,
          compare_at_price: 49.99,
        },
      ],
      images: [
        {
          src: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&h=500',
          alt: 'Test Product Image',
        },
      ],
    };

    return Response.json({
      action: 'create_test_product',
      status: 'ready',
      canonical_product: testProduct,
      next_step: 'Map to CJ product → call action: map_to_cj with cj_product_id',
    });
  }

  // ── Phase 1: Map to CJ ─────────────────────────────────────────────────
  if (action === 'map_to_cj') {
    if (!cj_product_id || !cj_sku) {
      return Response.json({
        error: 'cj_product_id and cj_sku required',
        hint: 'Browse CJ dashboard for a product ID and SKU',
      }, { status: 400 });
    }

    // Store mapping
    await base44.asServiceRole.entities.CJMapping.create({
      entity_type: 'variant',
      canonical_id: `test_variant_${Date.now()}_1`,
      cj_id: cj_product_id,
      cj_sku: cj_sku,
      sync_status: 'synced',
      last_synced_at: new Date().toISOString(),
      metadata: { test: true, mapped_at: new Date().toISOString() },
    });

    return Response.json({
      action: 'map_to_cj',
      status: 'success',
      mapping: { cj_product_id, cj_sku },
      next_step: 'Sync to Shopify → call action: sync_to_shopify',
    });
  }

  // ── Phase 1: Sync to Shopify ──────────────────────────────────────────
  if (action === 'sync_to_shopify') {
    // Fetch the latest CJ mapping to get real product data
    const mappings = await base44.asServiceRole.entities.CJMapping.filter({
      entity_type: 'variant',
      sync_status: 'synced',
    });
    
    if (mappings.length === 0) {
      return Response.json({
        action: 'sync_to_shopify',
        status: 'failed',
        error: 'No CJ mapping found. Complete step 2 (Map to CJ) first.',
      }, { status: 400 });
    }

    const mapping = mappings[mappings.length - 1];
    const cjProductId = mapping.cj_id;
    const cjSku = mapping.cj_sku;

    // Fetch real product from CJ
    let cjToken;
    try {
      cjToken = await getCJToken(base44, Deno.env.get('CJ_EMAIL'), Deno.env.get('CJ_API_KEY'));
    } catch (e) {
      return Response.json({
        action: 'sync_to_shopify',
        status: 'failed',
        error: `CJ auth failed: ${e.message}`,
      }, { status: 502 });
    }

    // Fetch real product data from CJ
    let cjProduct;
    try {
      const url = new URL(`${CJ_BASE}/product/query`);
      url.searchParams.set('pid', cjProductId);
      const cjRes = await fetch(url.toString(), {
        headers: { 'CJ-Access-Token': cjToken, 'Content-Type': 'application/json' },
      });
      const cjData = await cjRes.json();
      if (cjData.result === false) throw new Error(cjData.message);
      cjProduct = cjData.data || cjData;
    } catch (e) {
      return Response.json({
        action: 'sync_to_shopify',
        status: 'failed',
        error: `CJ product lookup failed: ${e.message}`,
      }, { status: 502 });
    }

    // Build variants with size/color options from CJ variant data
    const cjVariants = cjProduct.variants || [];
    const canonicalVariants = cjVariants.length > 0
      ? cjVariants.map((v, i) => ({
          canonical_id: `${mapping.canonical_id}_v${i}`,
          title: v.variantNameEn || v.variantName || 'Default',
          sku: v.variantSku || v.sku || cjSku,
          price: parseFloat(v.variantSellPrice || v.sellPrice || 19.99),
          compare_at_price: parseFloat(v.variantSellPrice || v.sellPrice || 19.99) * 1.5,
          option1: v.variantKey1 || null,
          option2: v.variantKey2 || null,
          weight: v.variantWeight || 0,
          weight_unit: 'g',
        }))
      : [{
          canonical_id: `${mapping.canonical_id}_v0`,
          title: 'Default',
          sku: cjSku,
          price: 19.99,
          compare_at_price: 39.99,
          option1: null,
          option2: null,
        }];

    // Determine options (Size, Color) from variant keys
    const option1Values = [...new Set(canonicalVariants.map(v => v.option1).filter(Boolean))];
    const option2Values = [...new Set(canonicalVariants.map(v => v.option2).filter(Boolean))];
    const options = [];
    if (option1Values.length > 0) options.push({ name: 'Size', values: option1Values });
    if (option2Values.length > 0) options.push({ name: 'Color', values: option2Values });

    // Collect all product images
    const allImages = [];
    if (cjProduct.productImage) allImages.push({ src: cjProduct.productImage, alt: cjProduct.productNameEn || '' });
    if (Array.isArray(cjProduct.productImages)) {
      for (const imgUrl of cjProduct.productImages) {
        if (imgUrl && !allImages.find(i => i.src === imgUrl)) {
          allImages.push({ src: imgUrl, alt: cjProduct.productNameEn || '' });
        }
      }
    }
    // Fallback image if none
    if (allImages.length === 0) {
      allImages.push({ src: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500&h=500', alt: 'Product Image' });
    }

    const testProduct = {
      canonical_id: mapping.canonical_id,
      title: cjProduct.productNameEn || cjProduct.productName || `CJ Product #${cjProductId}`,
      description: cjProduct.description || cjProduct.productDesc || '',
      description_html: cjProduct.description || '',
      brand: cjProduct.supplierName || 'CJ Dropshipping',
      product_type: 'dropship',
      vendor: 'CJ Dropshipping',
      variants: canonicalVariants,
      options: options.length > 0 ? options : undefined,
      images: allImages,
    };

    try {
      const syncRes = await base44.asServiceRole.functions.invoke('shopifySync', {
        action: 'create_product',
        product: testProduct,
      });

      return Response.json({
        action: 'sync_to_shopify',
        status: 'success',
        shopify_product_id: syncRes.data.shopify_id,
        next_step: 'Verify in Shopify dashboard → check your store',
      });
    } catch (e) {
      return Response.json({
        action: 'sync_to_shopify',
        status: 'failed',
        error: e.message,
      }, { status: 502 });
    }
  }

  // ── Phase 1: Verify in Shopify ─────────────────────────────────────────
  if (action === 'verify_in_shopify') {
    // Query ShopifyMapping to confirm product exists
    const mappings = await base44.asServiceRole.entities.ShopifyMapping.filter({
      entity_type: 'product',
      sync_status: 'synced',
    });

    const testMapping = mappings.find(m => m.metadata?.title?.includes('Test Product'));

    return Response.json({
      action: 'verify_in_shopify',
      status: testMapping ? 'success' : 'not_found',
      mapping: testMapping || null,
      all_products: mappings.slice(0, 10),
      hint: 'Log into your Shopify store and check Products → you should see "Test Product" live',
    });
  }

  // ── Pipeline Status ────────────────────────────────────────────────────
  if (action === 'get_status') {
    const [canonicalProducts, cjMappings, shopifyMappings] = await Promise.all([
      base44.asServiceRole.entities.CJMapping.filter({ entity_type: 'variant' }),
      base44.asServiceRole.entities.CJMapping.filter({ entity_type: 'product' }),
      base44.asServiceRole.entities.ShopifyMapping.filter({ entity_type: 'product' }),
    ]);

    return Response.json({
      action: 'get_status',
      phase_1_validation: {
        cj_variant_mappings: cjMappings.length,
        shopify_products: shopifyMappings.length,
        ready_for_phase_2: cjMappings.length > 0 && shopifyMappings.length > 0,
      },
      next_step: ready_for_phase_2 ? 'Proceed to Phase 2: Influencer System' : 'Complete Phase 1 first',
    });
  }

  return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
});