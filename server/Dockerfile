# syntax=docker/dockerfile:1
# Build context = thư mục gốc repo (vì server/package.json phụ thuộc "file:..").
#   docker build -f server/Dockerfile .

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json ./package.json
COPY server/package.json server/package-lock.json ./server/
WORKDIR /app/server
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force && mkdir /logs

# ─── Dev (docker-compose.yml): đủ devDependencies (nodemon), source mount
# từ máy host nên không COPY src. Stage prod phải luôn nằm CUỐI file để
# `docker build` / docker-compose.prod.yml (không chỉ định target) vẫn ra image prod.
FROM node:22-alpine AS dev
WORKDIR /app
COPY package.json ./package.json
COPY server/package.json server/package-lock.json ./server/
WORKDIR /app/server
RUN npm ci --no-audit --no-fund && npm cache clean --force
EXPOSE 3000
# -L (polling): bind mount qua Docker Desktop không phát fs-events
CMD ["node", "node_modules/nodemon/bin/nodemon.js", "-L", "src/index.js"]

# ─── Prod: Docker Hardened Image — chỉ có node (không npm, không shell, không
# apk), mặc định chạy user node (1000). Máy build phải `docker login dhi.io` (tài
# khoản Docker miễn phí). Cùng bản node 22 + musl với stage deps nên bcrypt chạy được.
FROM dhi.io/node:22-alpine3.22 AS prod
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000
WORKDIR /app
COPY --from=deps /app /app
COPY server/src ./server/src
# Chỉ thư mục log được ghi (image không có shell nên không RUN mkdir/chown được)
COPY --from=deps --chown=node:node /logs ./server/logs
USER node
WORKDIR /app/server

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/index.js"]
