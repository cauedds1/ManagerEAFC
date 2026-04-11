FROM node:22 AS builder
WORKDIR /app

RUN npm install -g pnpm@10.26.1

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tsconfig.json ./
COPY lib/ ./lib/
COPY artifacts/api-server/ ./artifacts/api-server/
COPY artifacts/fc-career-manager/ ./artifacts/fc-career-manager/

RUN pnpm install --frozen-lockfile

RUN BASE_PATH=/ pnpm --filter @workspace/fc-career-manager run build

RUN mkdir -p artifacts/api-server/public && \
    cp -r artifacts/fc-career-manager/dist/public/. artifacts/api-server/public/

RUN pnpm --filter @workspace/api-server run build

FROM node:22-slim AS runtime
WORKDIR /app

COPY --from=builder /app/artifacts/api-server/dist/ ./dist/
COPY --from=builder /app/artifacts/api-server/public/ ./public/

ENV NODE_ENV=production
ENV FRONTEND_DIST=/app/public

EXPOSE 3000

CMD ["node", "--enable-source-maps", "dist/index.mjs"]
