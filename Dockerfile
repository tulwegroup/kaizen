# ── Kaizen: Single container with backend API + frontend static files ───
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS backend-builder
WORKDIR /app
COPY backend/package.json backend/package-lock.json ./
RUN npm ci
COPY backend/ ./
RUN npx prisma generate
RUN npx tsc

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Backend
COPY --from=backend-builder /app/dist ./dist
COPY --from=backend-builder /app/node_modules ./node_modules
COPY --from=backend-builder /app/prisma ./prisma
COPY --from=backend-builder /app/package.json ./

# Frontend static files
COPY --from=frontend-builder /app/dist ./public

# Serve frontend static + API
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]
