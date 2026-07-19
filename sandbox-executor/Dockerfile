FROM node:20-slim

# Install docker CLI for sandbox container management
RUN apt-get update && apt-get install -y --no-install-recommends \
    docker.io-cli \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json tsconfig.json ./
COPY src/ ./src/

RUN npm ci && npx tsc && npm prune --omit=dev

EXPOSE 4090

CMD ["node", "dist/index.js"]
