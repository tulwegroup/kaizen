/**
 * Kaizen Backend — Express API Server
 * Replaces Base44 serverless functions with a self-hosted Node.js API.
 */
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from './config.js';
import { errorHandler } from './middleware/errorHandler.js';
import { optionalAuth } from './middleware/auth.js';

// Routes
import authRoutes from './routes/auth.js';
import entityRoutes from './routes/entities.js';
import agentResearchRoutes from './routes/agentResearch.js';
import shopifyRoutes from './routes/shopify.js';
import influencerRoutes from './routes/influencer.js';
import cjRoutes from './routes/cj.js';
import llmRoutes from './routes/llm.js';

const app = express();

// ── Middleware ────────────────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: config.frontendUrl, credentials: true }));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));

// ── Health check ──────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Public settings (like Base44) ────────────────────────────────────
app.get('/api/apps/public-settings', optionalAuth, (_req, res) => {
  res.json({
    id: 'kaizen',
    name: 'Kaizen',
    public_settings: { auth_required: false, app_name: 'Kaizen — Shopify & Influencer Platform' },
  });
});

// ── Auth (no auth required) ──────────────────────────────────────────
app.use('/api/auth', authRoutes);

// ── Entity CRUD ──────────────────────────────────────────────────────
app.use('/api', entityRoutes);

// ── Function routes (match base44.functions.invoke names) ────────────
app.use('/api', agentResearchRoutes);
app.use('/api', shopifyRoutes);
app.use('/api', influencerRoutes);
app.use('/api', cjRoutes);

// ── LLM proxy ─────────────────────────────────────────────────────────
app.use('/api', llmRoutes);

// ── Serve frontend static files (in Docker, they're at /app/public) ──
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const publicDir = join(__dirname, '..', 'public');
if (existsSync(publicDir)) {
  app.use(express.static(publicDir));
  app.get('*', (_req, res) => {
    res.sendFile(join(publicDir, 'index.html'));
  });
}

// ── Error handler ────────────────────────────────────────────────────
app.use(errorHandler);

// ── Start ────────────────────────────────────────────────────────────
app.listen(config.port, () => {
  console.log(`\n  🚀 Kaizen API Server`);
  console.log(`     Port: ${config.port}`);
  console.log(`     Env:  ${config.nodeEnv}`);
  console.log(`     CORS: ${config.frontendUrl}`);
  console.log(`     Health: http://localhost:${config.port}/api/health\n`);
});

export default app;
