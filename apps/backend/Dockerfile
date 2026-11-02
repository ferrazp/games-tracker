# Se construye desde la raíz del monorepo:
#   docker build -f apps/backend/Dockerfile -t games-tracker-backend .
FROM node:26-slim AS deps

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/
COPY apps/frontend/package.json apps/frontend/
# husky (prepare) es solo para desarrollo
RUN npm pkg delete scripts.prepare && npm ci -w games-backend --omit=dev --no-audit --no-fund

FROM node:26-slim AS runner

ARG APP_VERSION=dev
LABEL org.opencontainers.image.source="https://github.com/ferrazp/games-tracker" \
      org.opencontainers.image.title="games-tracker-backend" \
      org.opencontainers.image.version="${APP_VERSION}"

ENV NODE_ENV=production
WORKDIR /app

RUN groupadd -r appuser && useradd -r -g appuser -d /app -s /sbin/nologin appuser

COPY --from=deps /app/node_modules ./node_modules
COPY apps/backend/package.json ./
COPY apps/backend/db ./db
COPY apps/backend/src ./src
COPY apps/backend/scripts ./scripts
COPY apps/backend/server-unified.js ./

RUN chown -R appuser:appuser /app

USER appuser

EXPOSE 4000

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/health', r => {process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1))"

CMD ["node", "server-unified.js"]
