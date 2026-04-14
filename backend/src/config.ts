import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(import.meta.dirname, '..', '.env') });

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL!,
  jwtSecret: process.env.JWT_SECRET!,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  geminiApiKey: process.env.GEMINI_API_KEY,
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  resendApiKey: process.env.RESEND_API_KEY,
  shopify: {
    clientId: process.env.SHOPIFY_CLIENT_ID || '',
    clientSecret: process.env.SHOPIFY_CLIENT_SECRET || '',
    storeDomain: process.env.SHOPIFY_STORE_DOMAIN || '',
    shopUrl: process.env.SHOP_URL || '',
    webhookSecret: process.env.SHOPIFY_WEBHOOK_SECRET || '',
    apiVersion: '2026-01',
  },
  cj: {
    email: process.env.CJ_EMAIL || '',
    apiKey: process.env.CJ_API_KEY || '',
  },
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.EMAIL_FROM || 'noreply@shop.deeptech-ai.co.uk',
  },
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
} as const;
