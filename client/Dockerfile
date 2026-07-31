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

# 使用阿里云 Alpine 镜像源加速（国内服务器访问 dl-cdn.alpinelinux.org 极慢）
RUN echo 'https://mirrors.aliyun.com/alpine/v3.23/main' > /etc/apk/repositories \
 && echo 'https://mirrors.aliyun.com/alpine/v3.23/community' >> /etc/apk/repositories
RUN apk upgrade --no-cache

ARG APP_COMMIT_SHA=unknown
LABEL org.opencontainers.image.title="AIbak Web" \
      org.opencontainers.image.revision="$APP_COMMIT_SHA"

COPY --from=build /usr/src/app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
