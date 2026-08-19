# ---- Build stage ----
FROM node:22-slim AS build
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY backend/package.json backend/
COPY worker/package.json worker/
COPY frontend/package.json frontend/

RUN npm ci

COPY packages/shared packages/shared
COPY packages/db packages/db
COPY backend backend

RUN npm run build -w @render-server/shared \
  && npm run build -w @render-server/db \
  && npm run build -w @render-server/backend

# ---- Runtime stage ----
FROM node:22-slim
WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY backend/package.json backend/
COPY worker/package.json worker/
COPY frontend/package.json frontend/

RUN npm ci --omit=dev

COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/packages/db/dist packages/db/dist
COPY --from=build /app/backend/dist backend/dist

EXPOSE 3000

CMD ["node", "backend/dist/server.js"]
