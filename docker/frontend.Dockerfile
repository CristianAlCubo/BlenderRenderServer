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
COPY frontend frontend

RUN npm run build -w @render-server/shared \
  && npm run build -w @render-server/frontend

# ---- Serve static with nginx ----
FROM nginx:alpine
COPY docker/frontend/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 8080