/**
 * Email Service — uses Resend API (replaces base44.integrations.Core.SendEmail)
 * Falls back to nodemailer/SES if RESEND_API_KEY not set.
 */
import { config } from '../config.js';

// ── Resend (primary) ─────────────────────────────────────────────────

async function sendViaResend(to: string | string[], subject: string, html: string, from?: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('RESEND_API_KEY not configured');

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: from || config.smtp.from || 'Kaizen <noreply@shop.deeptech-ai.co.uk>',
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Resend error: ${err}`);
  }

  const data = await res.json();
  console.log(`[EMAIL] Sent via Resend to ${Array.isArray(to) ? to.length : to}, id=${data.id}`);
  return true;
}

// ── SMTP fallback (nodemailer) ───────────────────────────────────────

async function sendViaSMTP(to: string | string[], subject: string, html: string, from?: string) {
  if (!config.smtp.host) {
    console.warn('[EMAIL] SMTP not configured — skipping');
    return false;
  }

  const nodemailer = await import('nodemailer') as any;
  const transporter = nodemailer.default.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
    auth: { user: config.smtp.user, pass: config.smtp.pass },
  });

  await transporter.sendMail({
    from: from || config.smtp.from,
    to: Array.isArray(to) ? to.join(', ') : to,
    subject,
    html,
  });
  console.log(`[EMAIL] Sent via SMTP to ${Array.isArray(to) ? to.length : to}`);
  return true;
}

// ── Public API ────────────────────────────────────────────────────────

export async function sendEmail({
  to,
  subject,
  html,
  from,
}: {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
}): Promise<boolean> {
  try {
    if (process.env.RESEND_API_KEY) {
      return await sendViaResend(to, subject, html, from);
    }
    return await sendViaSMTP(to, subject, html, from);
  } catch (err: any) {
    console.error('[EMAIL] Send failed:', err.message);
    return false;
  }
}
