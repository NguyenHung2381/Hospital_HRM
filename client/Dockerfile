# syntax=docker/dockerfile:1
# Build context = thư mục gốc repo (vì client/package.json phụ thuộc "file:..").
#   docker build -f client/Dockerfile .

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json ./package.json
COPY client/package.json client/package-lock.json ./client/
WORKDIR /app/client
RUN npm ci --no-audit --no-fund
COPY client/ ./
RUN npm run build

# ─── Dev (docker-compose.dev.yml): Vite dev server, source mount từ máy host.
# Stage prod (nginx) phải luôn nằm CUỐI file — xem server/Dockerfile.
FROM node:22-bookworm-slim AS dev
WORKDIR /app
COPY package.json ./package.json
COPY client/package.json client/package-lock.json ./client/
WORKDIR /app/client
RUN npm ci --no-audit --no-fund && npm cache clean --force
EXPOSE 5173
CMD ["node", "node_modules/vite/bin/vite.js", "--host", "0.0.0.0"]

# nginx chạy bằng user thường, nghe cổng 8080
FROM nginxinc/nginx-unprivileged:1.27-alpine AS prod
COPY client/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/client/dist /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1
