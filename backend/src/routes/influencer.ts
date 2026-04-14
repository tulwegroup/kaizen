/**
 * Influencer & outreach routes — converts influencerDiscovery, influencerOutreach,
 * sendOutreachMessages, bulkSendOutreach, bulkGenerateInfluencers, sendInfluencerPitch,
 * influencerTracking, trackingSync
 */
import { Router, Response } from 'express';
import { prisma } from '../db.js';
import { invokeLLM } from '../services/llm.js';
import { sendEmail } from '../services/email.js';
import { authMiddleware, adminOnly, AuthRequest } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

// ── Influencer Discovery ──────────────────────────────────────────────
router.post('/influencer-discovery', adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const { action, platform, niche, min_followers = 10000, max_followers = 200000 } = req.body;

    if (action === 'search_tiktok' || action === 'search_instagram') {
      return res.json({
        action,
        status: 'not_implemented',
        message: `Awaiting ${platform} API integration. Set API key first.`,
      });
    }

    if (action === 'filter_by_size') {
      const profiles = await prisma.influencerProfile.findMany({
        where: {
          followerCount: { gte: min_followers, lte: max_followers },
          ...(platform ? { platform } : {}),
          ...(niche ? { niche } : {}),
        },
      });
      return res.json({ profiles });
    }

    if (action === 'score_engagement') {
      const profiles = await prisma.influencerProfile.findMany();
      const scored = profiles.map(p => {
        const score = p.engagementRate
          ? Math.round(p.engagementRate * 10 + (p.followerCount ? Math.log10(p.followerCount) * 5 : 0))
          : 0;
        return { ...p, engagement_score: score };
      });
      return res.json({ profiles: scored });
    }

    // Default: list all profiles
    const profiles = await prisma.influencerProfile.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json({ profiles });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Send Outreach Messages ────────────────────────────────────────────
router.post('/outreach/send', adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const { action } = req.body;

    if (action === 'send_campaign') {
      const { campaign_id } = req.body;
      const campaign = await prisma.influencerCampaign.findUnique({
        where: { id: campaign_id },
        include: { influencer: true },
      });
      if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

      const sent = await sendEmail({
        to: campaign.influencer.contactEmail || campaign.influencer.contactInstagram,
        subject: `Partnership: ${campaign.campaignName}`,
        html: campaign.messageSent || '<p>Hi! We would love to partner with you.</p>',
      });

      if (sent) {
        await prisma.influencerCampaign.update({
          where: { id: campaign_id },
          data: { status: 'outreach_sent' },
        });
        await prisma.influencerProfile.update({
          where: { id: campaign.influencerId },
          data: { status: 'contacted' },
        });
      }

      return res.json({ sent, campaign_id });
    }

    if (action === 'bulk_send') {
      const { campaign_ids } = req.body;
      const campaigns = await prisma.influencerCampaign.findMany({
        where: { id: { in: campaign_ids } },
        include: { influencer: true },
      });

      let sent = 0;
      for (const c of campaigns) {
        const ok = await sendEmail({
          to: c.influencer.contactEmail,
          subject: `Partnership: ${c.campaignName}`,
          html: c.messageSent || '<p>Partnership inquiry</p>',
        });
        if (ok) {
          await prisma.influencerCampaign.update({ where: { id: c.id }, data: { status: 'outreach_sent' } });
          sent++;
        }
      }
      return res.json({ sent, total: campaigns.length });
    }

    res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Generate Influencer Pitch ─────────────────────────────────────────
router.post('/outreach/generate-pitch', adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const { influencer_id, product_name, platform, style = 'friendly_casual' } = req.body;

    const profile = await prisma.influencerProfile.findUnique({ where: { id: influencer_id } });
    if (!profile) return res.status(404).json({ error: 'Influencer not found' });

    const result = await invokeLLM({
      model: 'claude_sonnet_4_6',
      prompt: `Generate an influencer outreach pitch for a ${style} style.

Influencer: ${profile.platformUsername} on ${profile.platform}
Followers: ${profile.followerCount}
Niche: ${profile.niche}
Engagement rate: ${profile.engagementRate}%
Product: ${product_name}
Platform: ${platform || profile.platform}

Return: subject_line, dm_text (the actual pitch message — personal and engaging, not corporate), fit_score (0-100).`,
      response_json_schema: {
        type: 'object',
        properties: {
          subject_line: { type: 'string' },
          dm_text: { type: 'string' },
          fit_score: { type: 'number' },
        },
      },
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Bulk Generate Influencers ─────────────────────────────────────────
router.post('/influencer/generate-bulk', adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const { niche, platform, count = 10 } = req.body;

    const result = await invokeLLM({
      model: 'gemini_3_flash',
      prompt: `Generate ${count} realistic influencer profiles for ${niche} on ${platform}.
Return an array of objects with: platform_username (realistic handle), follower_count, engagement_rate, niche, contact_email (realistic), bio (1 sentence).`,
      response_json_schema: {
        type: 'object',
        properties: {
          influencers: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                platform_username: { type: 'string' },
                follower_count: { type: 'number' },
                engagement_rate: { type: 'number' },
                niche: { type: 'string' },
                contact_email: { type: 'string' },
                bio: { type: 'string' },
              },
            },
          },
        },
      },
    });

    const influencers = (result.influencers as any[]) || [];

    // Auto-create in DB
    const created = [];
    for (const inf of influencers) {
      const record = await prisma.influencerProfile.create({
        data: {
          platform: platform || 'instagram',
          platformUsername: inf.platform_username,
          platformUserId: `gen_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          followerCount: inf.follower_count,
          engagementRate: inf.engagement_rate,
          niche: inf.niche,
          contactEmail: inf.contact_email,
          status: 'discovered',
          metadata: { bio: inf.bio, source: 'ai_generated' },
        },
      });
      created.push(record);
    }

    res.json({ created: created.length, influencers: created });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Influencer Tracking ───────────────────────────────────────────────
router.get('/influencer/tracking', adminOnly, async (_req: AuthRequest, res: Response) => {
  try {
    const conversions = await prisma.influencerConversion.findMany({
      include: { influencer: true, campaign: true },
      orderBy: { createdAt: 'desc' },
    });

    const summary = {
      total_conversions: conversions.length,
      total_revenue: conversions.reduce((s, c) => s + (c.conversionValue || 0), 0),
      total_commission: conversions.reduce((s, c) => s + (c.commissionEarned || 0), 0),
      by_influencer: {} as Record<string, any>,
    };

    for (const c of conversions) {
      if (!summary.by_influencer[c.influencerId]) {
        summary.by_influencer[c.influencerId] = {
          username: c.influencer.platformUsername,
          conversions: 0,
          revenue: 0,
          commission: 0,
        };
      }
      summary.by_influencer[c.influencerId].conversions++;
      summary.by_influencer[c.influencerId].revenue += c.conversionValue || 0;
      summary.by_influencer[c.influencerId].commission += c.commissionEarned || 0;
    }

    res.json({ conversions, summary });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Send Influencer Pitch (direct) ────────────────────────────────────
router.post('/influencer/send-pitch', adminOnly, async (req: AuthRequest, res: Response) => {
  try {
    const { influencer_id, subject, message } = req.body;
    const profile = await prisma.influencerProfile.findUnique({ where: { id: influencer_id } });
    if (!profile) return res.status(404).json({ error: 'Influencer not found' });

    const sent = await sendEmail({
      to: profile.contactEmail,
      subject: subject || 'Partnership Opportunity',
      html: message || '<p>We would love to work with you!</p>',
    });

    if (sent) {
      await prisma.influencerProfile.update({
        where: { id: influencer_id },
        data: { status: 'contacted' },
      });
    }

    res.json({ sent });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
