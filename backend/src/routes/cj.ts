/**
 * CJ Dropshipping routes — converts cjAdmin, cjProducts, cjOrders, orderRouter,
 * automatedPipeline, pipelineTest, productPipelineTest
 */
import { Router, Response } from 'express';
import { prisma } from '../db.js';
import { getCJToken, cjFetch, getCJTokenFromDB } from '../services/cj.js';
import { getShopifyToken, shopifyFetch } from '../services/shopify.js';
import { invokeLLM } from '../services/llm.js';
import { authMiddleware, adminOnly, AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// ── CJ Product Search ─────────────────────────────────────────────────
router.post('/cj/products', adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const { keywords, page = 1, pageSize = 20 } = req.body;
    const token = await getCJToken();
    const data = await cjFetch(
      `/v2/product/search?keywords=${encodeURIComponent(keywords)}&pageNum=${page}&pageSize=${pageSize}`,
      token
    );
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── CJ Product Detail ─────────────────────────────────────────────────
router.post('/cj/product/:id', adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const token = await getCJToken();
    const data = await cjFetch(`/v2/product/query?pid=${req.params.id}`, token);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── CJ Order List ─────────────────────────────────────────────────────
router.post('/cj/orders', adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const token = await getCJToken();
    const data = await cjFetch(`/v2/order/list?pageNum=1&pageSize=50`, token);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── CJ Auth / Session ─────────────────────────────────────────────────
router.post('/cj/auth', adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const { email, api_key } = req.body;
    const token = await getCJToken(email, api_key);
    await prisma.cJSession.upsert({
      where: { id: (await prisma.cJSession.findFirst({ where: { email } }))?.id || 'new' },
      create: { email: email || process.env.CJ_EMAIL, token, tokenExp: new Date(Date.now() + 86400000) },
      update: { token, tokenExp: new Date(Date.now() + 86400000) },
    });
    res.json({ status: 'success', token_set: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Order Router ──────────────────────────────────────────────────────
router.post('/order-router', adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const { order } = req.body;
    if (!order) return res.status(400).json({ error: 'order required' });

    // Check if this order has already been routed
    const existing = await prisma.cJMapping.findFirst({
      where: { entityType: 'order', canonicalId: String(order.id || order.order_number) },
    });
    if (existing) {
      return res.json({ status: 'already_routed', mapping: existing });
    }

    // Create mapping
    const mapping = await prisma.cJMapping.create({
      data: {
        entityType: 'order',
        canonicalId: String(order.id || order.order_number),
        cjId: null,
        syncStatus: 'pending',
        metadata: order,
      },
    });

    res.json({ status: 'routed', mapping });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Automated Pipeline ────────────────────────────────────────────────
router.post('/automated-pipeline', adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const { regions, niches, period = '1month', auto_import = false } = req.body;

    // Step 1: Run research
    const { invokeLLM } = await import('../services/llm.js');
    const research = await invokeLLM({
      model: 'gemini_3_flash',
      prompt: `E-commerce analyst. Date: ${new Date().toISOString().split('T')[0]}. Regions: ${regions?.join(', ') || 'US'}. Niches: ${niches?.join(', ') || 'all'}.
List 8 trending products. Return array with: product_name, product_type, niche, region, estimated_cogs, recommended_sell_price, gross_margin_pct, search_trend, why_it_works, cj_search_keywords (3), best_source. Also market_summary.`,
      response_json_schema: {
        type: 'object',
        properties: {
          products: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                product_name: { type: 'string' },
                product_type: { type: 'string' },
                niche: { type: 'string' },
                region: { type: 'string' },
                estimated_cogs: { type: 'number' },
                recommended_sell_price: { type: 'number' },
                gross_margin_pct: { type: 'number' },
                search_trend: { type: 'string' },
                why_it_works: { type: 'string' },
                cj_search_keywords: { type: 'array', items: { type: 'string' } },
                best_source: { type: 'string' },
              },
            },
          },
          market_summary: { type: 'string' },
        },
      },
    });

    // Step 2: Save as import job
    const job = await prisma.importJob.create({
      data: {
        title: `Auto Pipeline — ${new Date().toLocaleDateString()}`,
        source: 'pipeline',
        status: 'draft',
        regions: regions || [],
        niches: niches || [],
        period,
        productsRaw: JSON.stringify(research.products || []),
        totalCount: (research.products as any[])?.length || 0,
      },
    });

    // Step 3: Optionally auto-import to Shopify
    let imported = 0;
    if (auto_import && (research.products as any[])?.length) {
      try {
        const { getShopifyToken, shopifyFetch } = await import('../services/shopify.js');
        const { token } = await getShopifyToken();
        for (const p of research.products as any[]) {
          await shopifyFetch(token, '/products.json', {
            method: 'POST',
            body: JSON.stringify({
              product: {
                title: p.product_name,
                vendor: 'Kaizen',
                product_type: p.niche || '',
                status: 'draft',
                variants: [{ price: String(p.recommended_sell_price || '0'), inventory_quantity: 0 }],
                tags: `${p.niche || ''},${p.best_source || ''}`,
              },
            }),
          });
          imported++;
        }
        await prisma.importJob.update({
          where: { id: job.id },
          data: { status: imported > 0 ? 'partially_done' : 'draft', importedCount: imported },
        });
      } catch (e: any) {
        // Non-fatal — research saved but import failed
      }
    }

    res.json({
      status: 'success',
      job_id: job.id,
      products_found: (research.products as any[])?.length || 0,
      imported,
      market_summary: research.market_summary,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Pipeline Test ─────────────────────────────────────────────────────
router.post('/pipeline-test', adminOnly, async (req: AuthRequest, res: Response) => {
  res.json({
    status: 'success',
    message: 'Pipeline test endpoint ready. Send a POST with { regions, niches, period } to /api/automated-pipeline to run the full pipeline.',
  });
});

// ── Product Pipeline Test ─────────────────────────────────────────────
router.post('/product-pipeline-test', adminOnly, async (req: AuthRequest, res: Response) => {
  res.json({
    status: 'success',
    message: 'Product pipeline test endpoint ready.',
    steps: ['research', 'enrich', 'import', 'publish'],
  });
});

// ── CJ Dead Letter Queue ──────────────────────────────────────────────
router.get('/cj/dead-letters', adminOnly, async (_req: AuthRequest, res: Response) => {
  const letters = await prisma.cJDeadLetter.findMany({
    where: { status: 'pending_retry' },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ data: letters });
});

// ── CJ Sync Status ────────────────────────────────────────────────────
router.get('/cj/sync-status', adminOnly, async (_req: AuthRequest, res: Response) => {
  const [products, orders, shipments, drifted] = await Promise.all([
    prisma.cJMapping.count({ where: { entityType: 'product' } }),
    prisma.cJMapping.count({ where: { entityType: 'order' } }),
    prisma.cJMapping.count({ where: { entityType: 'shipment' } }),
    prisma.cJMapping.count({ where: { syncStatus: 'drift_detected' } }),
  ]);
  res.json({ products, orders, shipments, drifted });
});

// ── CJ Admin Diagnostic ───────────────────────────────────────────────
router.post('/cj/diagnostic', adminOnly, async (_req: AuthRequest, res: Response) => {
  try {
    const token = await getCJToken();
    res.json({
      status: 'connected',
      token_valid: !!token,
      db_sessions: await prisma.cJSession.count(),
    });
  } catch (err: any) {
    res.json({ status: 'error', error: err.message });
  }
});

export default router;
