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

    mappings.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    const mapping = mappings[0];
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

    // Only use options if ALL variants have a variantKey1 AND they are all unique
    const allHaveKey1 = cjVariants.length > 0 && cjVariants.every(v => v.variantKey1);
    const key1Values = allHaveKey1 ? [...new Set(cjVariants.map(v => v.variantKey1))] : [];
    const key2Values = allHaveKey1 ? [...new Set(cjVariants.map(v => v.variantKey2).filter(Boolean))] : [];
    // Unique option combos = count of unique [key1+key2] pairs must equal variant count
    const combos = cjVariants.map(v => `${v.variantKey1 || ''}_${v.variantKey2 || ''}`);
    const uniqueCombos = new Set(combos);
    const hasValidOptions = allHaveKey1 && uniqueCombos.size === cjVariants.length;

    // Determine options strategy
    let options = [];
    let useNameAsOption = false;

    if (hasValidOptions) {
      options.push({ name: 'Size', values: key1Values });
      if (key2Values.length > 0) options.push({ name: 'Color', values: key2Values });
    } else if (cjVariants.length > 1) {
      // Fallback: use truncated variant names as Title option
      useNameAsOption = true;
      const titleValues = cjVariants.map(v => (v.variantNameEn || v.variantName || `Variant ${cjVariants.indexOf(v) + 1}`).substring(0, 100));
      // Deduplicate by appending index if needed
      const seen = {};
      const uniqueTitleValues = titleValues.map((t, i) => {
        if (seen[t] !== undefined) return `${t} (${i + 1})`;
        seen[t] = i;
        return t;
      });
      options.push({ name: 'Title', values: uniqueTitleValues });
    }

    const canonicalVariants = cjVariants.length > 0
      ? cjVariants.map((v, i) => {
          const variant = {
            canonical_id: `${mapping.canonical_id}_v${i}`,
            title: v.variantNameEn || v.variantName || 'Default',
            sku: v.variantSku || v.sku || `${cjSku}-${i}`,
            price: parseFloat(v.variantSellPrice || v.sellPrice || 19.99),
            compare_at_price: parseFloat(v.variantSellPrice || v.sellPrice || 19.99) * 1.5,
            weight: v.variantWeight || 0,
            weight_unit: 'g',
          };
          if (hasValidOptions) {
            variant.option1 = v.variantKey1;
            if (key2Values.length > 0) variant.option2 = v.variantKey2 || null;
          } else if (useNameAsOption) {
            const rawName = (v.variantNameEn || v.variantName || `Variant ${i + 1}`).substring(0, 100);
            variant.option1 = options[0].values[i];
          }
          return variant;
        })
      : [{
          canonical_id: `${mapping.canonical_id}_v0`,
          title: 'Default',
          sku: cjSku,
          price: 19.99,
          compare_at_price: 39.99,
        }];

    // Collect all product images — productImage may be a JSON-encoded array string
    const allImages = [];
    const alt = cjProduct.productNameEn || '';
    const parseImageField = (field) => {
      if (!field) return [];
      if (Array.isArray(field)) return field.filter(Boolean);
      if (typeof field === 'string') {
        const trimmed = field.trim();
        if (trimmed.startsWith('[')) {
          try { return JSON.parse(trimmed).filter(Boolean); } catch (_) {}
        }
        return trimmed ? [trimmed] : [];
      }
      return [];
    };
    const seen = new Set();
    for (const src of [...parseImageField(cjProduct.productImage), ...parseImageField(cjProduct.productImages)]) {
      if (!seen.has(src)) { seen.add(src); allImages.push({ src, alt }); }
    }
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
      options: options.length > 0 ? options : null,
      images: allImages,
    };

    // Fetch Shopify session
    const shopDomain = Deno.env.get('SHOPIFY_STORE_DOMAIN');
    if (!shopDomain) return Response.json({ action: 'sync_to_shopify', status: 'failed', error: 'Missing SHOPIFY_STORE_DOMAIN' }, { status: 500 });

    const shopifySessions = await base44.asServiceRole.entities.ShopifySession.filter({ shop_domain: shopDomain });
    const shopifyToken = shopifySessions[0]?.access_token;
    if (!shopifyToken) return Response.json({ action: 'sync_to_shopify', status: 'failed', error: 'No Shopify session found. Complete OAuth first.' }, { status: 401 });

    // Build Shopify payload
    const hasOptions = testProduct.options && testProduct.options.length > 0;
    console.log('Building Shopify payload', { hasOptions, options: testProduct.options, variantCount: testProduct.variants.length, sampleVariant: testProduct.variants[0] });
    const shopifyPayload = {
      product: {
        title: testProduct.title,
        body_html: testProduct.description_html || testProduct.description || '',
        vendor: testProduct.vendor || testProduct.brand || '',
        product_type: testProduct.product_type || '',
        status: 'draft',
        variants: testProduct.variants.map(v => {
          const variant = {
            sku: v.sku || '',
            price: String(v.price || '0.00'),
            compare_at_price: v.compare_at_price ? String(v.compare_at_price) : null,
            inventory_management: 'shopify',
            inventory_policy: 'deny',
            fulfillment_service: 'manual',
            weight: v.weight || 0,
            weight_unit: v.weight_unit || 'lb',
          };
          if (hasOptions) {
            variant.option1 = v.option1 || 'Default';
            if (testProduct.options.length > 1) variant.option2 = v.option2 || null;
          }
          return variant;
        }),
      },
    };
    if (hasOptions) {
      shopifyPayload.product.options = testProduct.options.map(o => ({ name: o.name, values: o.values }));
    }
    // Only include images with valid http/https URLs
    const validImages = (testProduct.images || []).filter(img => img.src && /^https?:\/\/.+/.test(img.src));
    if (validImages.length > 0) {
      shopifyPayload.product.images = validImages.map(img => ({ src: img.src, alt: img.alt || '' }));
    }

    const shopifyRes = await fetch(`https://${shopDomain}/admin/api/2026-01/products.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': shopifyToken },
      body: JSON.stringify(shopifyPayload),
    });

    if (!shopifyRes.ok) {
      const errText = await shopifyRes.text();
      return Response.json({ action: 'sync_to_shopify', status: 'failed', error: `Shopify API error [${shopifyRes.status}]: ${errText}` }, { status: 502 });
    }

    const shopifyData = await shopifyRes.json();
    const shopifyProduct = shopifyData.product;

    // Save mapping
    await base44.asServiceRole.entities.ShopifyMapping.create({
      entity_type: 'product',
      canonical_id: testProduct.canonical_id,
      shopify_id: String(shopifyProduct.id),
      shopify_gid: `gid://shopify/Product/${shopifyProduct.id}`,
      shop_domain: shopDomain,
      sync_status: 'synced',
      last_synced_at: new Date().toISOString(),
      metadata: { title: shopifyProduct.title, handle: shopifyProduct.handle },
    });

    return Response.json({
      action: 'sync_to_shopify',
      status: 'success',
      shopify_product_id: String(shopifyProduct.id),
      shopify_handle: shopifyProduct.handle,
      shopify_status: shopifyProduct.status,
      next_step: 'Verify in Shopify dashboard → check your store',
    });
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

  // ── Debug: inspect CJ product + Shopify payload ──────────────────────────
  if (action === 'debug_payload') {
    const mappings = await base44.asServiceRole.entities.CJMapping.filter({ entity_type: 'variant', sync_status: 'synced' });
    if (mappings.length === 0) return Response.json({ error: 'No mapping found' }, { status: 400 });
    mappings.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    const mapping = mappings[0];

    let cjToken;
    try { cjToken = await getCJToken(base44, Deno.env.get('CJ_EMAIL'), Deno.env.get('CJ_API_KEY')); }
    catch (e) { return Response.json({ error: `CJ auth: ${e.message}` }, { status: 502 }); }

    const url = new URL(`${CJ_BASE}/product/query`);
    url.searchParams.set('pid', mapping.cj_id);
    const cjRes = await fetch(url.toString(), { headers: { 'CJ-Access-Token': cjToken, 'Content-Type': 'application/json' } });
    const cjData = await cjRes.json();
    const cjProduct = cjData.data || cjData;
    const cjVariants = cjProduct.variants || [];

    const allHaveKey1 = cjVariants.length > 0 && cjVariants.every(v => v.variantKey1);
    const key1Values = allHaveKey1 ? [...new Set(cjVariants.map(v => v.variantKey1))] : [];
    const key2Values = allHaveKey1 ? [...new Set(cjVariants.map(v => v.variantKey2).filter(Boolean))] : [];
    const combos = cjVariants.map(v => `${v.variantKey1 || ''}_${v.variantKey2 || ''}`);
    const uniqueCombos = new Set(combos);
    const hasValidOptions = allHaveKey1 && uniqueCombos.size === cjVariants.length;

    return Response.json({
      mapping_cj_id: mapping.cj_id,
      cj_product_title: cjProduct.productNameEn,
      cj_variants_count: cjVariants.length,
      allHaveKey1, key1Values, key2Values, hasValidOptions,
      combos: [...combos],
      unique_combos_count: uniqueCombos.size,
      raw_variants_sample: cjVariants.slice(0, 5).map(v => ({ variantKey1: v.variantKey1, variantKey2: v.variantKey2, variantSku: v.variantSku, variantNameEn: v.variantNameEn })),
      product_image: cjProduct.productImage,
      product_images: cjProduct.productImages,
      product_image_set: cjProduct.productImageSet,
      all_image_keys: Object.keys(cjProduct).filter(k => k.toLowerCase().includes('image')),
    });
  }

  return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
});