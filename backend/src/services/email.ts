/**
 * Email Service — replaces base44.integrations.Core.SendEmail
 * Uses nodemailer, configurable for AWS SES or any SMTP.
 */
import nodemailer from 'nodemailer';
import { config } from '../config.js';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.pass,
      },
    });
  }
  return transporter;
}

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
  if (!config.smtp.host) {
    console.warn('[EMAIL] SMTP not configured — skipping send');
    return false;
  }

  try {
    await getTransporter().sendMail({
      from: from || config.smtp.from,
      to: Array.isArray(to) ? to.join(', ') : to,
      subject,
      html,
    });
    console.log(`[EMAIL] Sent to ${Array.isArray(to) ? to.length : to}`);
    return true;
  } catch (err) {
    console.error('[EMAIL] Send failed:', err);
    return false;
  }
}
