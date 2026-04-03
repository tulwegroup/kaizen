/**
 * sendOutreachMessages
 * Sends outreach emails to influencers for a given campaign or list of campaign IDs.
 * Uses Base44's built-in SendEmail integration.
 * 
 * Actions:
 *   send_campaign   — send email for a single campaign ID
 *   send_bulk       — send emails for an array of campaign IDs
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'POST only' }, { status: 405 });

  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user || user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

  const { action, campaign_id, campaign_ids } = await req.json();

  const ids = action === 'send_bulk' ? (campaign_ids || []) : [campaign_id];
  if (!ids.length) return Response.json({ error: 'campaign_id or campaign_ids required' }, { status: 400 });

  const results = [];

  for (const cid of ids) {
    const campaigns = await base44.asServiceRole.entities.InfluencerCampaign.filter({ id: cid });
    const campaign = campaigns[0];
    if (!campaign) { results.push({ campaign_id: cid, status: 'failed', reason: 'Campaign not found' }); continue; }

    // Get influencer
    const influencers = await base44.asServiceRole.entities.InfluencerProfile.filter({ id: campaign.influencer_id });
    const influencer = influencers[0];
    if (!influencer) { results.push({ campaign_id: cid, status: 'failed', reason: 'Influencer not found' }); continue; }

    if (!influencer.contact_email) {
      results.push({ campaign_id: cid, status: 'skipped', reason: 'No contact email on file', influencer: influencer.platform_username });
      continue;
    }

    if (campaign.status === 'outreach_sent' && campaign.metadata?.email_sent) {
      results.push({ campaign_id: cid, status: 'skipped', reason: 'Email already sent', influencer: influencer.platform_username });
      continue;
    }

    // Build subject from campaign name
    const productName = campaign.metadata?.product_name || campaign.campaign_name;
    const subject = `Collaboration Opportunity: ${productName} 🎁`;

    // Send the email
    await base44.integrations.Core.SendEmail({
      to: influencer.contact_email,
      subject,
      body: campaign.message_sent || `Hi @${influencer.platform_username},\n\nWe have an exciting collaboration opportunity for you!\n\nBest regards`,
    });

    // Mark email as sent
    await base44.asServiceRole.entities.InfluencerCampaign.update(cid, {
      status: 'outreach_sent',
      metadata: { ...(campaign.metadata || {}), email_sent: true, email_sent_at: new Date().toISOString() },
    });

    results.push({ campaign_id: cid, status: 'sent', influencer: influencer.platform_username, email: influencer.contact_email });
  }

  const sent = results.filter(r => r.status === 'sent').length;
  const skipped = results.filter(r => r.status === 'skipped').length;
  const failed = results.filter(r => r.status === 'failed').length;

  return Response.json({ success: true, sent, skipped, failed, results });
});