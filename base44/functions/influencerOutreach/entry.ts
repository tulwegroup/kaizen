/**
 * Influencer Outreach Module — Phase 2
 * Automated outreach + personalization + rate limiting.
 * NOT ACTIVATED YET — prep only.
 *
 * Actions:
 *   send_outreach     — send DM/email to influencer with personalized message
 *   generate_discount — create unique discount code for influencer
 *   generate_referral — create tracking link with UTM params
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405 });

  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user?.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

  const body = await req.json();
  const { action, influencer_id, message_template, commission_rate } = body;

  // ── Generate unique discount code ─────────────────────────────────────
  if (action === 'generate_discount') {
    if (!influencer_id) return Response.json({ error: 'influencer_id required' }, { status: 400 });

    const profile = await base44.asServiceRole.entities.InfluencerProfile.filter({
      id: influencer_id,
    }).then(r => r[0]);

    if (!profile) return Response.json({ error: 'Influencer not found' }, { status: 404 });

    const discountCode = `INFL_${profile.platform_username.toUpperCase()}_${Math.random().toString(36).substring(7)}`;

    await base44.asServiceRole.entities.InfluencerProfile.update(influencer_id, {
      discount_code: discountCode,
    });

    return Response.json({
      action: 'generate_discount',
      discount_code: discountCode,
      influencer: profile.platform_username,
    });
  }

  // ── Generate referral link with UTM params ────────────────────────────
  if (action === 'generate_referral') {
    if (!influencer_id) return Response.json({ error: 'influencer_id required' }, { status: 400 });

    const profile = await base44.asServiceRole.entities.InfluencerProfile.filter({
      id: influencer_id,
    }).then(r => r[0]);

    if (!profile) return Response.json({ error: 'Influencer not found' }, { status: 404 });

    const baseUrl = Deno.env.get('SHOP_URL') || 'https://shop.example.com';
    const referralLink = `${baseUrl}?utm_source=${profile.platform}&utm_medium=influencer&utm_campaign=${profile.platform_username}&ref=${profile.discount_code}`;

    await base44.asServiceRole.entities.InfluencerProfile.update(influencer_id, {
      referral_link: referralLink,
    });

    return Response.json({
      action: 'generate_referral',
      referral_link: referralLink,
      influencer: profile.platform_username,
    });
  }

  // ── Send outreach (DM/email) ──────────────────────────────────────────
  if (action === 'send_outreach') {
    if (!influencer_id || !message_template) {
      return Response.json({ error: 'influencer_id and message_template required' }, { status: 400 });
    }

    const profile = await base44.asServiceRole.entities.InfluencerProfile.filter({
      id: influencer_id,
    }).then(r => r[0]);

    if (!profile) return Response.json({ error: 'Influencer not found' }, { status: 404 });

    // Rate limiting: check outreach frequency
    const existingCampaigns = await base44.asServiceRole.entities.InfluencerCampaign.filter({
      influencer_id,
      status: 'outreach_sent',
    });

    if (existingCampaigns.length > 0) {
      return Response.json({
        status: 'rate_limited',
        message: 'Outreach already sent to this influencer',
        hint: 'Wait for response or mark campaign as declined',
      });
    }

    // Personalize message (simple: replace {name} with influencer's username)
    const personalizedMessage = message_template.replace('{name}', profile.platform_username);

    // TODO: Send via DM (TikTok/Instagram API) or email (SendEmail integration)
    // For now: create campaign record in draft state

    const campaign = await base44.asServiceRole.entities.InfluencerCampaign.create({
      campaign_name: `Campaign_${profile.platform_username}_${Date.now()}`,
      influencer_id,
      status: 'outreach_sent',
      message_sent: personalizedMessage,
      commission_rate: commission_rate || 15,
      commission_type: 'percentage',
      metadata: {
        outreach_date: new Date().toISOString(),
        platform: profile.platform,
      },
    });

    return Response.json({
      action: 'send_outreach',
      status: 'success',
      campaign_id: campaign.id,
      message: personalizedMessage,
      hint: 'Message queued for Phase 2 API activation (TikTok/Instagram DM)',
    });
  }

  return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
});