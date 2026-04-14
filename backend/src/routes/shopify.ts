/**
 * Shopify routes — converts shopifyAuth, shopifyOAuth, shopifySync,
 * getShopifyProducts, importResearchProduct, publishProductsToStorefront, etc.
 */
import { Router, Response } from 'express';
import { prisma } from '../db.js';
import { invokeLLM } from '../services/llm.js';
import { shopifyFetch, getShopifyToken, persistShopifySession } from '../services/shopify.js';
import { authMiddleware, adminOnly, AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// ── Store Token ───────────────────────────────────────────────────────
router.post('/shopify/store-token', adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const { access_token, scope } = req.body;
    if (!access_token) return res.status(400).json({ error: 'access_token required' });

    await persistShopifySession(req.body.shop_domain || process.env.SHOPIFY_STORE_DOMAIN, access_token, scope || '');
    res.json({ status: 'success', token_stored: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Validate Token ────────────────────────────────────────────────────
router.post('/shopify/validate', adminOnly, async (_req: AuthRequest, res: Response) => {
  try {
    const { token, domain } = await getShopifyToken();
    const shop = await shopifyFetch(token, '/shop.json');
    res.json({ status: 'success', shop: shop.shop });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ── Get Products ──────────────────────────────────────────────────────
router.post('/shopify/products', adminOnly, async (_req: AuthRequest, res: Response) => {
  try {
    const { token } = await getShopifyToken();
    const data = await shopifyFetch(token, '/products.json?status=active&limit=250');
    res.json({ products: data.products });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Import Research Product to Shopify ────────────────────────────────
router.post('/import-research-product', adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const { product: p } = req.body;
    const { token } = await getShopifyToken();

    const shopifyProduct = {
      product: {
        title: p.product_name || p.title,
        body_html: p.description || p.body_html || '',
        vendor: p.vendor || 'Kaizen',
        product_type: p.product_type_shopify || p.product_type || '',
        status: 'draft',
        variants: [{
          price: String(p.recommended_sell_price || p.price || '0'),
          compare_at_price: p.compare_at_price ? String(p.compare_at_price) : undefined,
          inventory_management: 'shopify',
          inventory_quantity: 0,
        }],
        tags: p.tags || '',
      },
    };

    const result = await shopifyFetch(token, '/products.json', {
      method: 'POST',
      body: JSON.stringify(shopifyProduct),
    });

    res.json({ success: true, product: result.product });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── Publish All Drafts ────────────────────────────────────────────────
router.post('/shopify/publish-all-drafts', adminOnly, async (_req: AuthRequest, res: Response) => {
  try {
    const { token } = await getShopifyToken();
    const data = await shopifyFetch(token, '/products.json?status=draft&limit=250');
    let published = 0;
    for (const product of data.products) {
      await shopifyFetch(token, `/products/${product.id}.json`, {
        method: 'PUT',
        body: JSON.stringify({ product: { id: product.id, status: 'active' } }),
      });
      published++;
    }
    res.json({ status: 'success', published });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Publish Products to Storefront ────────────────────────────────────
router.post('/shopify/publish-to-storefront', adminOnly, async (_req: AuthRequest, res: Response) => {
  try {
    const { token } = await getShopifyToken();
    const data = await shopifyFetch(token, '/products.json?status=draft&limit=250');
    let published = 0;
    for (const product of data.products) {
      await shopifyFetch(token, `/products/${product.id}.json`, {
        method: 'PUT',
        body: JSON.stringify({ product: { id: product.id, status: 'active', published_scope: 'global' } }),
      });
      published++;
    }
    res.json({ status: 'success', published });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Fix Product Images ────────────────────────────────────────────────
router.post('/shopify/fix-images', adminOnly, async (_req: AuthRequest, res: Response) => {
  try {
    const { token } = await getShopifyToken();
    const data = await shopifyFetch(token, '/products.json?limit=250');
    let fixed = 0;
    for (const product of data.products) {
      if (!product.image || !product.image.src) continue;
      await shopifyFetch(token, `/products/${product.id}.json`, {
        method: 'PUT',
        body: JSON.stringify({ product: { id: product.id, images: [{ src: product.image.src }] } }),
      });
      fixed++;
    }
    res.json({ status: 'success', fixed });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Disable Inventory Tracking ────────────────────────────────────────
router.post('/shopify/disable-inventory', adminOnly, async (_req: AuthRequest, res: Response) => {
  try {
    const { token } = await getShopifyToken();
    const data = await shopifyFetch(token, '/products.json?limit=250');
    let updated = 0;
    for (const product of data.products) {
      for (const variant of product.variants) {
        await shopifyFetch(token, `/variants/${variant.id}.json`, {
          method: 'PUT',
          body: JSON.stringify({ variant: { id: variant.id, inventory_management: '', inventory_quantity: null } }),
        });
        updated++;
      }
    }
    res.json({ status: 'success', updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Fix Collections ───────────────────────────────────────────────────
router.post('/shopify/fix-collections', adminOnly, async (_req: AuthRequest, res: Response) => {
  try {
    const { token } = await getShopifyToken();
    const data = await shopifyFetch(token, '/custom_collections.json?limit=250');
    res.json({ status: 'success', collections: data.custom_collections });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Populate Collections ──────────────────────────────────────────────
router.post('/shopify/populate-collections', adminOnly, async (_req: AuthRequest, res: Response) => {
  try {
    const { token } = await getShopifyToken();
    const [productsData, collectionsData] = await Promise.all([
      shopifyFetch(token, '/products.json?limit=250'),
      shopifyFetch(token, '/custom_collections.json?limit=250'),
    ]);
    let added = 0;
    for (const collection of collectionsData.custom_collections) {
      for (const product of productsData.products) {
        await shopifyFetch(token, `/collections/${collection.id}/products.json`, {
          method: 'POST',
          body: JSON.stringify({ product_id: product.id }),
        }).catch(() => {});
        added++;
      }
    }
    res.json({ status: 'success', added });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Create Shopify Pages ──────────────────────────────────────────────
router.post('/shopify/create-pages', adminOnly, async (_req: AuthRequest, res: Response) => {
  try {
    const { token } = await getShopifyToken();
    const pages = [
      { title: 'About Us', handle: 'about-us', body_html: '<h1>About Us</h1><p>Welcome to our store.</p>' },
      { title: 'Contact Us', handle: 'contact', body_html: '<h1>Contact Us</h1><p>Reach out to us anytime.</p>' },
      { title: 'Shipping Policy', handle: 'shipping-policy', body_html: '<h1>Shipping Policy</h1><p>We ship worldwide.</p>' },
      { title: 'Return Policy', handle: 'return-policy', body_html: '<h1>Return Policy</h1><p>30-day returns.</p>' },
    ];
    let created = 0;
    for (const page of pages) {
      await shopifyFetch(token, '/pages.json', {
        method: 'POST',
        body: JSON.stringify({ page }),
      });
      created++;
    }
    res.json({ status: 'success', created });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Webhook receiver ──────────────────────────────────────────────────
router.post('/shopify/webhooks', async (req: Request, res: Response) => {
  try {
    const topic = req.headers['x-shopify-topic'] as string;
    const shopDomain = req.headers['x-shopify-shop-domain'] as string;
    const payload: any = req.body || {};

    console.log(`[WEBHOOK] ${topic} from ${shopDomain}`);

    // Store webhook in dead letter for processing
    await prisma.shopifyDeadLetter.create({
      data: {
        entityType: 'webhook',
        operation: topic || 'unknown',
        payload,
        error: '',
        status: 'pending_retry',
      },
    });

    res.json({ received: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
