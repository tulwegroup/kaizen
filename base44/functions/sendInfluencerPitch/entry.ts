import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') || `partnerships@${Deno.env.get('SHOPIFY_STORE_DOMAIN') || 'store.com'}`;

Deno.serve(async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'POST only' }, { status: 405 });

  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { to_email, handle, platform, subject, dm_text, product_name, from_name } = await req.json();

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

  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${from_name || 'Partnerships Team'} <${FROM_EMAIL}>`,
      to: [to_email],
      subject: subject || `Partnership opportunity — ${product_name}`,
      html: htmlBody,
    }),
  });

  if (!resendRes.ok) {
    const err = await resendRes.json();
    return Response.json({ error: 'Email send failed', details: err }, { status: 500 });
  }

  return Response.json({ success: true, sent_to: to_email });
});