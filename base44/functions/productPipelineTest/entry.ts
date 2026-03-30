/**
 * Product Pipeline Test — Phase 1 Validation
 * Creates a test product, maps to CJ, syncs to Shopify, verifies end-to-end.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user?.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

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
    const testProduct = {
      canonical_id: `test_product_${Date.now()}`,
      title: 'Test Product — Phase 1 Validation',
      description: 'This is a test product for pipeline validation',
      brand: 'TestBrand',
      product_type: 'dropship',
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
          alt: 'Test Product',
        },
      ],
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