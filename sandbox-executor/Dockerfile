FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json tsconfig.json ./
COPY src/ ./src/

RUN npm ci && npx tsc && npm prune --omit=dev

EXPOSE 4090

CMD ["node", "dist/index.js"]
