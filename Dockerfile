# ── Kaizen: Single container — sequential build to avoid OOM ──────────
FROM node:20-alpine AS builder
WORKDIR /app

# Backend deps first
COPY backend/package.json backend/package-lock.json ./backend/
RUN cd backend && npm ci

# Frontend deps
COPY package.json package-lock.json ./
RUN npm ci

# Generate Prisma client
COPY backend/prisma ./backend/prisma
COPY backend/package.json ./backend/package.json
RUN cd backend && npx prisma generate

# Build frontend
COPY . .
RUN npm run build

# ── Runner ────────────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Backend deps + source
COPY --from=builder /app/backend/package.json ./package.json
COPY --from=builder /app/backend/node_modules ./node_modules
COPY --from=builder /app/backend/prisma ./prisma
COPY --from=builder /app/backend/src ./src
COPY --from=builder /app/backend/tsconfig.json ./

# Frontend static files
COPY --from=builder /app/dist ./public

# Entrypoint — inline to avoid CRLF issues
RUN echo '#!/bin/sh' > /docker-entrypoint.sh && echo 'npx prisma db push 2>/dev/null || npx prisma migrate deploy 2>/dev/null || true' >> /docker-entrypoint.sh && echo 'exec "$@"' >> /docker-entrypoint.sh && chmod +x /docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["npx", "tsx", "src/index.ts"]
