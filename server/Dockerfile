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

# The production process only needs the Node runtime. Removing npm/npx also removes
# npm's bundled dependency tree from the attack surface (including packages that
# are irrelevant to the application but still reported by image scanners).
RUN rm -rf /usr/local/lib/node_modules/npm \
  && rm -f /usr/local/bin/npm /usr/local/bin/npx \
  && mkdir -p /usr/src/app/.cache/assets
  && mkdir -p /usr/src/app/uploads \
  && chown -R node:node /usr/src/app/uploads \
  && node --version
USER node

EXPOSE 3000
CMD ["node", "dist/index.js"]
