# syntax=docker/dockerfile:1.7
FROM node:22-bookworm-slim AS build

WORKDIR /usr/src/app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY tsconfig*.json vite.config.* index.html ./
COPY public ./public
COPY src ./src
RUN npm run build

FROM nginx:1.27-alpine AS runtime

ARG APP_COMMIT_SHA=unknown
LABEL org.opencontainers.image.title="AIbak Web" \
      org.opencontainers.image.revision="$APP_COMMIT_SHA"

COPY --from=build /usr/src/app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
