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
# Skip tsc — use tsx for runtime transpilation
RUN npm install --save-dev tsx

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Backend source + deps
COPY --from=backend-builder /app/src ./src
COPY --from=backend-builder /app/node_modules ./node_modules
COPY --from=backend-builder /app/prisma ./prisma
COPY --from=backend-builder /app/package.json ./
COPY --from=backend-builder /app/tsconfig.json ./

# Frontend static files
COPY --from=frontend-builder /app/dist ./public

# Entry point
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["npx", "tsx", "src/index.ts"]
