/**
 * Shopify Product Sync Service
 * Outbound sync from canonical system to Shopify.
 * Handles create product, update product, variants, pricing, and media.
 * Maintains canonical ↔ Shopify ID mappings.
 *
 * POST / with JSON body — see handler routing below.
 *
 * Required env vars:
 *   SHOPIFY_ACCESS_TOKEN  — Admin API access token
 *   SHOPIFY_STORE_DOMAIN  — e.g. my-store.myshopify.com
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const SHOPIFY_API_VERSION = '2026-01';

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
  const remaining = res.headers.get('X-Shopify-Shop-Api-Call-Limit');
  if (remaining) {
    const [used, total] = remaining.split('/').map(Number);
    if (used >= total * 0.80) {
      console.warn('Shopify rate limit approaching', { used, total });
    }
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Shopify API ${method} ${path} failed [${res.status}]: ${errText}`);
  }
  return res.json();
}

// ── Build Shopify product payload from canonical spec ──────────────────────
function buildShopifyProductPayload(canonicalProduct) {
  const product = {
    title: canonicalProduct.title,
    body_html: canonicalProduct.description_html || canonicalProduct.description || '',
    vendor: canonicalProduct.brand || canonicalProduct.vendor || '',
    product_type: canonicalProduct.product_type || '',
    tags: Array.isArray(canonicalProduct.tags) ? canonicalProduct.tags.join(', ') : '',
    status: canonicalProduct.shopify_status || 'draft',
  };

  const hasOptions = canonicalProduct.options && canonicalProduct.options.length > 0;

  if (canonicalProduct.variants && canonicalProduct.variants.length > 0) {
    product.variants = canonicalProduct.variants.map(v => {
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
        if (canonicalProduct.options.length > 1) variant.option2 = v.option2 || null;
      }
      return variant;
    });
  }

  if (hasOptions) {
    product.options = canonicalProduct.options.map(o => ({
      name: o.name,
      values: o.values,
    }));
  }

  if (canonicalProduct.images && canonicalProduct.images.length > 0) {
    product.images = canonicalProduct.images.map(img => ({ src: img.src, alt: img.alt || '' }));
  }

  return { product };
}

// ── Create product in Shopify + write mapping ──────────────────────────────
async function createProduct(base44, domain, accessToken, canonicalProduct) {
  const payload = buildShopifyProductPayload(canonicalProduct);
  const result = await shopifyRequest(domain, accessToken, 'POST', '/products.json', payload);
  const shopifyProduct = result.product;

  await base44.asServiceRole.entities.ShopifyMapping.create({
    entity_type: 'product',
    canonical_id: canonicalProduct.canonical_id,
    shopify_id: String(shopifyProduct.id),
    shopify_gid: `gid://shopify/Product/${shopifyProduct.id}`,
    shop_domain: domain,
    sync_status: 'synced',
    last_synced_at: new Date().toISOString(),
    metadata: { title: shopifyProduct.title, handle: shopifyProduct.handle },
  });

  // Map variants
  if (shopifyProduct.variants && canonicalProduct.variants) {
    for (let i = 0; i < shopifyProduct.variants.length; i++) {
      const sv = shopifyProduct.variants[i];
      const cv = canonicalProduct.variants[i];
      if (cv && cv.canonical_id) {
        await base44.asServiceRole.entities.ShopifyMapping.create({
          entity_type: 'variant',
          canonical_id: cv.canonical_id,
          shopify_id: String(sv.id),
          shopify_gid: `gid://shopify/ProductVariant/${sv.id}`,
          shop_domain: domain,
          sync_status: 'synced',
          last_synced_at: new Date().toISOString(),
          metadata: { product_shopify_id: String(shopifyProduct.id), sku: sv.sku },
        });
      }
    }
  }

  console.log('Product created in Shopify', {
    canonical_id: canonicalProduct.canonical_id,
    shopify_id: shopifyProduct.id,
  });

  return { shopify_id: String(shopifyProduct.id), shopify_product: shopifyProduct };
}

// ── Update product in Shopify ──────────────────────────────────────────────
async function updateProduct(base44, domain, accessToken, canonicalProduct, shopifyProductId) {
  const payload = buildShopifyProductPayload(canonicalProduct);
  const result = await shopifyRequest(
    domain, accessToken, 'PUT',
    `/products/${shopifyProductId}.json`, payload
  );

  await base44.asServiceRole.entities.ShopifyMapping.filter({
    entity_type: 'product',
    canonical_id: canonicalProduct.canonical_id,
    shop_domain: domain,
  }).then(async (mappings) => {
    if (mappings.length > 0) {
      await base44.asServiceRole.entities.ShopifyMapping.update(mappings[0].id, {
        sync_status: 'synced',
        last_synced_at: new Date().toISOString(),
      });
    }
  });

  console.log('Product updated in Shopify', {
    canonical_id: canonicalProduct.canonical_id,
    shopify_id: shopifyProductId,
  });

  return { shopify_id: shopifyProductId, shopify_product: result.product };
}

// ── Update variant price ───────────────────────────────────────────────────
async function updateVariantPrice(base44, domain, accessToken, canonicalVariantId, price, compareAtPrice) {
  const mappings = await base44.asServiceRole.entities.ShopifyMapping.filter({
    entity_type: 'variant',
    canonical_id: canonicalVariantId,
    shop_domain: domain,
  });

  if (mappings.length === 0) {
    throw new Error(`No Shopify mapping found for variant: ${canonicalVariantId}`);
  }

  const shopifyVariantId = mappings[0].shopify_id;
  const variantPayload = {
    variant: {
      id: shopifyVariantId,
      price: String(price),
      compare_at_price: compareAtPrice ? String(compareAtPrice) : null,
    },
  };

  const result = await shopifyRequest(
    domain, accessToken, 'PUT',
    `/variants/${shopifyVariantId}.json`, variantPayload
  );

  await base44.asServiceRole.entities.ShopifyMapping.update(mappings[0].id, {
    sync_status: 'synced',
    last_synced_at: new Date().toISOString(),
    metadata: { ...mappings[0].metadata, price: String(price) },
  });

  return { shopify_variant_id: shopifyVariantId, updated_price: price };
}

// ── Main handler ───────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const domain = Deno.env.get('SHOPIFY_STORE_DOMAIN');
  if (!domain) {
    return Response.json({ error: 'Missing SHOPIFY_STORE_DOMAIN' }, { status: 500 });
  }

  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  // Read access token from ShopifySession (stored via OAuth)
  const sessions = await base44.asServiceRole.entities.ShopifySession.filter({ shop_domain: domain });
  const accessToken = sessions[0]?.access_token;
  if (!accessToken) {
    return Response.json({ error: 'No Shopify session found. Complete OAuth first.' }, { status: 401 });
  }

  const body = await req.json();
  const { action, product, canonical_variant_id, price, compare_at_price } = body;

  if (action === 'create_product') {
    if (!product || !product.canonical_id) {
      return Response.json({ error: 'product.canonical_id required' }, { status: 400 });
    }

    // Check if mapping already exists (idempotency)
    const existing = await base44.asServiceRole.entities.ShopifyMapping.filter({
      entity_type: 'product',
      canonical_id: product.canonical_id,
      shop_domain: domain,
    });

    if (existing.length > 0) {
      return Response.json({
        action: 'create_product',
        status: 'already_exists',
        shopify_id: existing[0].shopify_id,
        message: 'Product already mapped — use update_product to sync changes',
      });
    }

    const result = await createProduct(base44, domain, accessToken, product);
    return Response.json({ action: 'create_product', status: 'success', ...result });
  }

  if (action === 'update_product') {
    if (!product || !product.canonical_id) {
      return Response.json({ error: 'product.canonical_id required' }, { status: 400 });
    }

    const mappings = await base44.asServiceRole.entities.ShopifyMapping.filter({
      entity_type: 'product',
      canonical_id: product.canonical_id,
      shop_domain: domain,
    });

    if (mappings.length === 0) {
      // No mapping found — create instead
      const result = await createProduct(base44, domain, accessToken, product);
      return Response.json({ action: 'create_product', status: 'success', note: 'mapping_not_found_created_instead', ...result });
    }

    const result = await updateProduct(base44, domain, accessToken, product, mappings[0].shopify_id);
    return Response.json({ action: 'update_product', status: 'success', ...result });
  }

  if (action === 'update_price') {
    if (!canonical_variant_id || price === undefined) {
      return Response.json({ error: 'canonical_variant_id and price required' }, { status: 400 });
    }
    const result = await updateVariantPrice(base44, domain, accessToken, canonical_variant_id, price, compare_at_price);
    return Response.json({ action: 'update_price', status: 'success', ...result });
  }

  if (action === 'get_mapping') {
    const { entity_type, canonical_id } = body;
    if (!entity_type || !canonical_id) {
      return Response.json({ error: 'entity_type and canonical_id required' }, { status: 400 });
    }
    const mappings = await base44.asServiceRole.entities.ShopifyMapping.filter({
      entity_type,
      canonical_id,
      shop_domain: domain,
    });
    return Response.json({ action: 'get_mapping', mapping: mappings[0] || null });
  }

  return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
});