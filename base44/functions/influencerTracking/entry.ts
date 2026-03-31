/**
 * Influencer Tracking & Attribution — Phase 2
 * Tracks conversions, calculates commissions, generates leaderboards.
 * NOT ACTIVATED YET — prep only.
 *
 * Actions:
 *   track_conversion  — record order tied to influencer discount code
 *   get_metrics       — revenue, ROI, sales count per influencer
 *   leaderboard       — top performers
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user || user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

  const body = await req.json();
  const { action, influencer_id, shopify_order_id, discount_code_used, conversion_value } = body;

  // ── Track conversion ──────────────────────────────────────────────────
  if (action === 'track_conversion') {
    if (!influencer_id || !shopify_order_id || !conversion_value) {
      return Response.json({
        error: 'influencer_id, shopify_order_id, conversion_value required',
      }, { status: 400 });
    }

    const profile = await base44.asServiceRole.entities.InfluencerProfile.get(influencer_id);
    if (!profile) return Response.json({ error: 'Influencer not found' }, { status: 404 });

    // Get active campaign for this influencer
    const campaigns = await base44.asServiceRole.entities.InfluencerCampaign.filter({
      influencer_id,
      status: 'active',
    });

    const campaign = campaigns[0];
    if (!campaign) {
      return Response.json({
        error: 'No active campaign for this influencer',
      }, { status: 404 });
    }

    // Calculate commission
    const commission = campaign.commission_type === 'percentage'
      ? (conversion_value * campaign.commission_rate) / 100
      : campaign.commission_rate;

    // Record conversion
    await base44.asServiceRole.entities.InfluencerConversion.create({
      influencer_id,
      campaign_id: campaign.id,
      shopify_order_id,
      discount_code_used: discount_code_used || profile.discount_code,
      conversion_value,
      commission_earned: commission,
      conversion_date: new Date().toISOString(),
    });

    return Response.json({
      action: 'track_conversion',
      status: 'success',
      conversion_value,
      commission_earned: commission,
      influencer: profile.platform_username,
    });
  }

  // ── Get influencer metrics ───────────────────────────────────────────
  if (action === 'get_metrics') {
    if (!influencer_id) return Response.json({ error: 'influencer_id required' }, { status: 400 });

    const profile = await base44.asServiceRole.entities.InfluencerProfile.get(influencer_id);
    if (!profile) return Response.json({ error: 'Influencer not found' }, { status: 404 });

    const conversions = await base44.asServiceRole.entities.InfluencerConversion.filter({
      influencer_id,
    });

    const totalRevenue = conversions.reduce((sum, c) => sum + (c.conversion_value || 0), 0);
    const totalCommission = conversions.reduce((sum, c) => sum + (c.commission_earned || 0), 0);
    const roi = totalRevenue > 0 ? ((totalCommission / totalRevenue) * 100).toFixed(2) : 0;

    return Response.json({
      action: 'get_metrics',
      influencer: profile.platform_username,
      followers: profile.follower_count,
      engagement_score: profile.engagement_score,
      conversions: conversions.length,
      total_revenue: totalRevenue,
      total_commission: totalCommission,
      roi_percentage: roi,
    });
  }

  // ── Leaderboard ──────────────────────────────────────────────────────
  if (action === 'leaderboard') {
    const { limit = 10, sort_by = 'commission' } = body;

    const profiles = await base44.asServiceRole.entities.InfluencerProfile.filter({});
    const conversions = await base44.asServiceRole.entities.InfluencerConversion.filter({});

    // Aggregate by influencer
    const stats = {};
    for (const conv of conversions) {
      if (!stats[conv.influencer_id]) {
        stats[conv.influencer_id] = { conversions: 0, revenue: 0, commission: 0 };
      }
      stats[conv.influencer_id].conversions += 1;
      stats[conv.influencer_id].revenue += conv.conversion_value || 0;
      stats[conv.influencer_id].commission += conv.commission_earned || 0;
    }

    // Rank
    const ranked = profiles
      .map(p => ({
        ...p,
        ...stats[p.id] || { conversions: 0, revenue: 0, commission: 0 },
      }))
      .sort((a, b) => {
        if (sort_by === 'commission') return b.commission - a.commission;
        if (sort_by === 'conversions') return b.conversions - a.conversions;
        if (sort_by === 'engagement') return b.engagement_score - a.engagement_score;
        return 0;
      })
      .slice(0, limit);

    return Response.json({
      action: 'leaderboard',
      sort_by,
      top_influencers: ranked,
    });
  }

  return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
});