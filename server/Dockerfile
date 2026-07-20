# syntax=docker/dockerfile:1.7
FROM node:22-bookworm-slim AS build

WORKDIR /usr/src/app
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY tsconfig.json ./
COPY src ./src
RUN npm run build \
  && npm prune --omit=dev \
  && npm cache clean --force

FROM node:22-bookworm-slim AS runtime

ARG APP_COMMIT_SHA=unknown
LABEL org.opencontainers.image.title="AIbak API" \
      org.opencontainers.image.revision="$APP_COMMIT_SHA"

ENV NODE_ENV=production \
    PORT=3000
WORKDIR /usr/src/app

COPY --chown=node:node package.json package-lock.json ./
COPY --from=build --chown=node:node /usr/src/app/node_modules ./node_modules
COPY --from=build --chown=node:node /usr/src/app/dist ./dist

# npx 保留：MCP 插件通过白名单机制 (MCP_ALLOWED_STDIO_COMMANDS) 限制可执行命令，
# 仅允许 node/npx，杜绝任意命令执行风险。
#
# Chromium：供 Puppeteer MCP 插件使用（无头浏览器自动化）
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    chromium \
  && rm -rf /var/lib/apt/lists/*
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

RUN mkdir -p /usr/src/app/.cache/assets \
  && mkdir -p /usr/src/app/uploads \
  && rm -rf /usr/local/lib/node_modules/npm \
  && rm -f /usr/local/bin/npm /usr/local/bin/npx \
  && chown -R node:node /usr/src/app/uploads /usr/src/app/.cache \
  && node --version
USER node

EXPOSE 3000
CMD ["node", "dist/index.js"]