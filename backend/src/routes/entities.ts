/**
 * Entity CRUD routes — replaces base44.entities.* for the 5 main entities.
 * Each entity gets: POST (create), GET list, GET :id, PUT :id, DELETE :id
 */
import { Router, Response, Request } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { authMiddleware, AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// ── Helper ────────────────────────────────────────────────────────────
function paginate(req: Request) {
  const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
  const offset = parseInt(req.query.offset as string) || 0;
  return { take: limit, skip: offset };
}

// ══════════════════════════════════════════════════════════════════════
// ImportJob
// ══════════════════════════════════════════════════════════════════════
router.get('/import-jobs', async (req: AuthRequest, res: Response) => {
  const { take, skip } = paginate(req);
  const sort = (req.query.sort as string) || 'created_at';
  const order: any = {};
  order[sort] = (req.query.order as string) || 'desc';

  const [items, total] = await Promise.all([
    prisma.importJob.findMany({ take, skip, orderBy: order }),
    prisma.importJob.count(),
  ]);
  res.json({ data: items, total });
});

router.post('/import-jobs', async (req: AuthRequest, res: Response) => {
  const item = await prisma.importJob.create({ data: req.body });
  res.status(201).json(item);
});

router.get('/import-jobs/:id', async (req: AuthRequest, res: Response) => {
  const item = await prisma.importJob.findUnique({ where: { id: req.params.id } });
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

router.put('/import-jobs/:id', async (req: AuthRequest, res: Response) => {
  const item = await prisma.importJob.update({ where: { id: req.params.id }, data: req.body });
  res.json(item);
});

router.delete('/import-jobs/:id', async (req: AuthRequest, res: Response) => {
  await prisma.importJob.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

// ══════════════════════════════════════════════════════════════════════
// InfluencerProfile
// ══════════════════════════════════════════════════════════════════════
router.get('/influencer-profiles', async (req: AuthRequest, res: Response) => {
  const { take, skip } = paginate(req);
  const sort = (req.query.sort as string) || 'created_at';
  const order: any = {};
  order[sort] = (req.query.order as string) || 'desc';

  // Support filter query param
  const where: any = {};
  if (req.query.status) where.status = req.query.status;
  if (req.query.platform) where.platform = req.query.platform;
  if (req.query.niche) where.niche = req.query.niche;

  const [items, total] = await Promise.all([
    prisma.influencerProfile.findMany({ where, take, skip, orderBy: order }),
    prisma.influencerProfile.count({ where }),
  ]);
  res.json({ data: items, total });
});

router.post('/influencer-profiles', async (req: AuthRequest, res: Response) => {
  const item = await prisma.influencerProfile.create({ data: req.body });
  res.status(201).json(item);
});

router.get('/influencer-profiles/:id', async (req: AuthRequest, res: Response) => {
  const item = await prisma.influencerProfile.findUnique({
    where: { id: req.params.id },
    include: { campaigns: true, conversions: true },
  });
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

router.put('/influencer-profiles/:id', async (req: AuthRequest, res: Response) => {
  const item = await prisma.influencerProfile.update({ where: { id: req.params.id }, data: req.body });
  res.json(item);
});

router.delete('/influencer-profiles/:id', async (req: AuthRequest, res: Response) => {
  await prisma.influencerProfile.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

// ══════════════════════════════════════════════════════════════════════
// InfluencerCampaign
// ══════════════════════════════════════════════════════════════════════
router.get('/influencer-campaigns', async (req: AuthRequest, res: Response) => {
  const { take, skip } = paginate(req);
  const sort = (req.query.sort as string) || 'created_at';
  const order: any = {};
  order[sort] = (req.query.order as string) || 'desc';

  const where: any = {};
  if (req.query.status) where.status = req.query.status;
  if (req.query.influencer_id) where.influencerId = req.query.influencer_id;

  const [items, total] = await Promise.all([
    prisma.influencerCampaign.findMany({ where, take, skip, orderBy: order, include: { influencer: true } }),
    prisma.influencerCampaign.count({ where }),
  ]);
  res.json({ data: items, total });
});

router.post('/influencer-campaigns', async (req: AuthRequest, res: Response) => {
  const item = await prisma.influencerCampaign.create({ data: req.body });
  res.status(201).json(item);
});

router.get('/influencer-campaigns/:id', async (req: AuthRequest, res: Response) => {
  const item = await prisma.influencerCampaign.findUnique({
    where: { id: req.params.id },
    include: { influencer: true, conversions: true },
  });
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

router.put('/influencer-campaigns/:id', async (req: AuthRequest, res: Response) => {
  const item = await prisma.influencerCampaign.update({ where: { id: req.params.id }, data: req.body });
  res.json(item);
});

// ══════════════════════════════════════════════════════════════════════
// InfluencerConversion
// ══════════════════════════════════════════════════════════════════════
router.get('/influencer-conversions', async (req: AuthRequest, res: Response) => {
  const { take, skip } = paginate(req);
  const sort = (req.query.sort as string) || 'created_at';
  const order: any = {};
  order[sort] = (req.query.order as string) || 'desc';

  const where: any = {};
  if (req.query.influencer_id) where.influencerId = req.query.influencer_id;

  const [items, total] = await Promise.all([
    prisma.influencerConversion.findMany({ where, take, skip, orderBy: order, include: { influencer: true, campaign: true } }),
    prisma.influencerConversion.count({ where }),
  ]);
  res.json({ data: items, total });
});

router.post('/influencer-conversions', async (req: AuthRequest, res: Response) => {
  const item = await prisma.influencerConversion.create({ data: req.body });
  res.status(201).json(item);
});

// ══════════════════════════════════════════════════════════════════════
// PitchTemplate
// ══════════════════════════════════════════════════════════════════════
router.get('/pitch-templates', async (req: AuthRequest, res: Response) => {
  const { take, skip } = paginate(req);
  const [items, total] = await Promise.all([
    prisma.pitchTemplate.findMany({ take, skip, orderBy: { createdAt: 'desc' } }),
    prisma.pitchTemplate.count(),
  ]);
  res.json({ data: items, total });
});

router.post('/pitch-templates', async (req: AuthRequest, res: Response) => {
  const item = await prisma.pitchTemplate.create({ data: req.body });
  res.status(201).json(item);
});

router.get('/pitch-templates/:id', async (req: AuthRequest, res: Response) => {
  const item = await prisma.pitchTemplate.findUnique({ where: { id: req.params.id } });
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json(item);
});

router.put('/pitch-templates/:id', async (req: AuthRequest, res: Response) => {
  const item = await prisma.pitchTemplate.update({ where: { id: req.params.id }, data: req.body });
  res.json(item);
});

router.delete('/pitch-templates/:id', async (req: AuthRequest, res: Response) => {
  await prisma.pitchTemplate.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

export default router;
