FROM node:20-slim

# Install docker CLI matching host version (27.x) for sandbox container management
# Download static binary matching host Docker 27.x (API 1.46+)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl \
    && DOCKER_VER="27.3.1" \
    && curl -fsSLo /tmp/docker.tgz "https://mirrors.aliyun.com/docker-ce/linux/static/stable/x86_64/docker-${DOCKER_VER}.tgz" \
    && tar -xzf /tmp/docker.tgz -C /usr/local/bin --strip-components=1 docker/docker \
    && rm /tmp/docker.tgz \
    && chmod +x /usr/local/bin/docker \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json tsconfig.json ./
COPY src/ ./src/

RUN npm ci && npx tsc && npm prune --omit=dev

EXPOSE 4090

CMD ["node", "dist/index.js"]
