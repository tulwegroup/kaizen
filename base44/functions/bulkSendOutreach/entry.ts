/**
 * bulkSendOutreach
 * Sends personalized outreach emails to a batch of influencers.
 * Each email addresses the influencer by handle, mentions the specific product,
 * the commission they earn, and the discount code for their followers.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'POST only' }, { status: 405 });

  const base44 = createClientFromRequest(req);

  const {
    influencer_ids,
    product_name,
    product_description,
    commission_pct = 15,
    follower_discount_pct = 10,
    brand_name = 'Our Store',
    sender_name = 'The Partnerships Team',
    custom_message = '',
    pitch_template = null,
    pitch_subject = null,
  } = await req.json();

  if (!influencer_ids?.length || !product_name) {
    return Response.json({ error: 'influencer_ids and product_name required' }, { status: 400 });
  }

  // Fetch influencer profiles
  const profiles = [];
  for (const id of influencer_ids) {
    try {
      const list = await base44.asServiceRole.entities.InfluencerProfile.filter({ id });
      if (list.length) profiles.push(list[0]);
    } catch (_) {}
  }

  const results = { sent: 0, failed: 0, skipped: 0, details: [] };

  for (const influencer of profiles) {
    const email = influencer.contact_email;
    if (!email) {
      results.skipped++;
      results.details.push({ id: influencer.id, handle: influencer.platform_username, status: 'skipped', reason: 'no email' });
      continue;
    }

    const handle = influencer.platform_username || 'there';
    const platform = influencer.platform === 'tiktok' ? 'TikTok' : 'Instagram';
    const platformEmoji = influencer.platform === 'tiktok' ? '🎵' : '📸';
    const niche = influencer.niche || 'lifestyle';
    const followerCount = influencer.follower_count ? influencer.follower_count.toLocaleString() : '';
    const discountCode = `${handle.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)}${follower_discount_pct}`;
    const commissionAmount = commission_pct;

    // If a saved pitch template is provided, use it (replacing the handle placeholder)
    const personalizedBody = pitch_template
      ? pitch_template.replace(/@\w+/g, `@${handle}`).replace(/\[handle\]/gi, `@${handle}`)
      : `
Hi @${handle}! 👋

${platformEmoji} We've been following your ${niche} content on ${platform} — your audience engagement is genuinely impressive${followerCount ? ` (${followerCount} followers!)` : ''}, and we think you'd be a perfect fit for what we're building.

We'd love to partner with you to promote <strong>${product_name}</strong>${product_description ? ` — ${product_description}` : ''}.

Here's what we're offering:

💰 <strong>${commissionAmount}% commission</strong> on every sale you drive — tracked through your personal link
🎁 <strong>Exclusive ${follower_discount_pct}% discount</strong> for your followers using code: <strong>${discountCode}</strong>
📦 A free product sample sent to you before anything goes live
🤝 Flexible content format — one post, story, or short video is all we ask

${custom_message ? `<em>${custom_message}</em>\n\n` : ''}Your followers trust your opinion, and that's exactly what makes this partnership valuable. The discount code <strong>${discountCode}</strong> is created specifically for your community — so when they use it, you earn.

If this sounds interesting, just reply to this email and we'll take care of everything from there. No complicated contracts, no minimum commitments.

Looking forward to working with you,
${sender_name}
${brand_name} Partnerships
    `.trim();

    const htmlBody = `
<div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 620px; margin: 0 auto; padding: 32px 24px; background: #ffffff;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 16px; padding: 24px 28px; margin-bottom: 28px; text-align: center;">
    <p style="color: rgba(255,255,255,0.8); font-size: 13px; margin: 0 0 4px;">${platformEmoji} ${platform} Partnership Opportunity</p>
    <p style="color: #ffffff; font-size: 18px; font-weight: 700; margin: 0;">@${handle}</p>
  </div>
  
  <div style="font-size: 15px; line-height: 1.8; color: #2d2d2d; white-space: pre-wrap;">${personalizedBody.replace(/\n/g, '<br/>')}</div>
  
  <div style="margin-top: 32px; background: #f8f9ff; border: 1px solid #e8ebff; border-radius: 12px; padding: 20px 24px;">
    <p style="font-size: 13px; font-weight: 700; color: #667eea; margin: 0 0 12px; text-transform: uppercase; letter-spacing: 0.5px;">Your Partnership Summary</p>
    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
      <tr><td style="padding: 6px 0; color: #888;">Product</td><td style="padding: 6px 0; font-weight: 600; color: #1a1a1a;">${product_name}</td></tr>
      <tr><td style="padding: 6px 0; color: #888;">Your Commission</td><td style="padding: 6px 0; font-weight: 600; color: #22c55e;">${commissionAmount}% per sale</td></tr>
      <tr><td style="padding: 6px 0; color: #888;">Follower Discount Code</td><td style="padding: 6px 0; font-weight: 700; color: #667eea; font-size: 16px;">${discountCode}</td></tr>
      <tr><td style="padding: 6px 0; color: #888;">Discount Value</td><td style="padding: 6px 0; font-weight: 600; color: #1a1a1a;">${follower_discount_pct}% off for followers</td></tr>
    </table>
  </div>
  
  <div style="margin-top: 28px; border-top: 1px solid #eee; padding-top: 20px; font-size: 12px; color: #aaa; text-align: center;">
    ${brand_name} · Influencer Partnerships<br/>
    You're receiving this because your ${platform} profile matches our creator criteria.
  </div>
</div>`;

    try {
      await base44.integrations.Core.SendEmail({
        to: email,
        subject: pitch_subject || `${platformEmoji} Partnership opportunity for @${handle} — ${commissionAmount}% commission + ${follower_discount_pct}% for your followers`,
        body: htmlBody,
        from_name: `${brand_name} Partnerships`,
      });

      // Save campaign record
      try {
        await base44.asServiceRole.entities.InfluencerCampaign.create({
          campaign_name: `${product_name} — @${handle}`,
          influencer_id: influencer.id,
          status: 'outreach_sent',
          discount_code: discountCode,
          commission_rate: commissionAmount,
          commission_type: 'percentage',
          message_sent: personalizedBody,
          metadata: {
            product_name,
            follower_discount_pct,
            sent_at: new Date().toISOString(),
            platform,
          },
        });
      } catch (_) {}

      results.sent++;
      results.details.push({ id: influencer.id, handle, email, status: 'sent', discount_code: discountCode });
    } catch (err) {
      results.failed++;
      results.details.push({ id: influencer.id, handle, email, status: 'failed', reason: err.message });
    }
  }

  return Response.json({ success: true, ...results });
});