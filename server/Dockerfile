# syntax=docker/dockerfile:1
# Build context = thư mục gốc repo (vì server/package.json phụ thuộc "file:..").
#   docker build -f server/Dockerfile .

FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json ./package.json
COPY server/package.json server/package-lock.json ./server/
WORKDIR /app/server
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

FROM node:22-bookworm-slim
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000
WORKDIR /app
COPY --from=deps /app /app
COPY server/src ./server/src

# Chạy bằng user thường (không phải root); chỉ thư mục log được ghi
RUN mkdir -p /app/server/logs && chown node:node /app/server/logs
USER node
WORKDIR /app/server

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/index.js"]
