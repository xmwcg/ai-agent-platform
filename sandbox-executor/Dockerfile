FROM node:20-slim

# 安装 Docker CLI（用于调用宿主机的 Docker daemon）
RUN apt-get update && apt-get install -y --no-install-recommends docker.io && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json tsconfig.json ./
COPY src/ ./src/

RUN npm ci --omit=dev && \
    npx tsc && \
    npm prune --omit=dev

EXPOSE 4090

USER node

CMD ["node", "dist/index.js"]
