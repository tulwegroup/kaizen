import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'POST only' }, { status: 405 });

  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { to_email, handle, platform, subject, dm_text, product_name } = await req.json();

  if (!to_email || !dm_text) return Response.json({ error: 'to_email and dm_text required' }, { status: 400 });

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <div style="background: #f8f8f8; border-radius: 12px; padding: 20px 24px; margin-bottom: 16px;">
        <p style="font-size: 13px; color: #888; margin: 0 0 6px;">
          ${platform === 'tiktok' ? '🎵 TikTok' : '📸 Instagram'} · @${handle}
        </p>
        <p style="font-size: 13px; color: #888; margin: 0;">Re: ${product_name}</p>
      </div>
      <div style="white-space: pre-wrap; font-size: 15px; line-height: 1.7; color: #1a1a1a;">
${dm_text}
      </div>
      <div style="margin-top: 32px; border-top: 1px solid #eee; padding-top: 16px; font-size: 12px; color: #aaa;">
        Sent via Influencer Outreach Agent
      </div>
    </div>
  `;

  await base44.integrations.Core.SendEmail({
    to: to_email,
    subject: subject || `Partnership opportunity — ${product_name}`,
    body: htmlBody,
  });

  return Response.json({ success: true, sent_to: to_email });
});