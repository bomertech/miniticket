FROM node:20-bookworm-slim AS base

WORKDIR /app

ENV NODE_ENV=production

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ sqlite3 ca-certificates tzdata \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./

RUN npm install

COPY . .

RUN npm run build \
  && npm prune --omit=dev

EXPOSE 3000

CMD ["npm", "run", "start"]
