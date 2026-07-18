FROM node:20-slim

# 安装 Docker CLI（用于调用宿主机的 Docker daemon）
RUN apt-get update && apt-get install -y --no-install-recommends docker.io && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json tsconfig.json ./
COPY src/ ./src/

# 先安装全部依赖（含 typescript / @types），编译后再 prune 掉 dev 依赖，
# 避免 --omit=dev 后 npx tsc 需临时联网下载 typescript 导致的随机构建失败。
RUN npm ci && \
    npx tsc && \
    npm prune --omit=dev

EXPOSE 4090

USER node

CMD ["node", "dist/index.js"]
