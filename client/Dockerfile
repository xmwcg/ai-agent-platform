# syntax=docker/dockerfile:1.7
FROM node:22-bookworm-slim AS build

# 增大 Node 堆内存，避免 vite 在生产机构建时 OOM（尤其 2G 内存的部署机）
ENV NODE_OPTIONS=--max-old-space-size=2048

WORKDIR /usr/src/app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY tsconfig*.json vite.config.* index.html ./
COPY public ./public
COPY src ./src
RUN npm run build

FROM nginx:1.30.0-alpine3.23 AS runtime

# The official tag is refreshed independently of Alpine security packages.
# Upgrade the pinned Alpine release during every --pull build so Trivy scans
# the latest patched packages instead of the base image's stale package set.
RUN apk upgrade --no-cache

ARG APP_COMMIT_SHA=unknown
LABEL org.opencontainers.image.title="AIbak Web" \
      org.opencontainers.image.revision="$APP_COMMIT_SHA"

COPY --from=build /usr/src/app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
