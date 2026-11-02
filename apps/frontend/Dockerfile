# Se construye desde la raíz del monorepo:
#   docker build -f apps/frontend/Dockerfile -t games-tracker-frontend .
FROM node:24-slim AS builder

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/
COPY apps/frontend/package.json apps/frontend/
RUN npm pkg delete scripts.prepare && npm ci -w games-tracker --no-audit --no-fund

COPY apps/frontend/public apps/frontend/public
COPY apps/frontend/src apps/frontend/src
COPY apps/frontend/vite.config.js apps/frontend/index.html apps/frontend/

# Relativa: el nginx de esta imagen hace proxy de /api al backend del mismo
# proyecto compose, así la misma imagen sirve en QA y en Prod.
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build -w games-tracker

FROM nginx:1.31-alpine AS runner

ARG APP_VERSION=dev
LABEL org.opencontainers.image.source="https://github.com/ferrazp/games-tracker" \
      org.opencontainers.image.title="games-tracker-frontend" \
      org.opencontainers.image.version="${APP_VERSION}"

RUN adduser -D -g '' -h /app appuser

COPY --from=builder /app/apps/frontend/dist /usr/share/nginx/html
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf

RUN chown -R appuser:appuser /usr/share/nginx/html /var/cache/nginx /var/run && \
    chmod -R 755 /usr/share/nginx/html && \
    touch /var/run/nginx.pid && \
    chown appuser:appuser /var/run/nginx.pid

USER appuser

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:80/ || exit 1
