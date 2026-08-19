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
COPY worker worker

RUN npm run build -w @render-server/shared \
  && npm run build -w @render-server/db \
  && npm run build -w @render-server/worker

# ---- Runtime stage (Blender + FFmpeg) ----
FROM debian:trixie-slim
WORKDIR /app

ARG BLENDER_VERSION=5.1.2
ARG BLENDER_MAJOR=5.1

# System libs required by the official Blender binary + FFmpeg
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ffmpeg \
    ca-certificates \
    curl \
    xz-utils \
    libegl1 libgles2 libgl1 libglx-mesa0 libegl-mesa0 \
    libx11-6 libxext6 libxfixes3 libxi6 libxrender1 libxxf86vm1 \
    libxkbcommon0 libwayland-client0 libwayland-egl1 \
    libsm6 libice6 libxrandr2 libtinfo6 \
  && rm -rf /var/lib/apt/lists/*

# Install the official Blender release (pinned version)
RUN curl -fsSL -o /tmp/blender.tar.xz \
      "https://download.blender.org/release/Blender${BLENDER_MAJOR}/blender-${BLENDER_VERSION}-linux-x64.tar.xz" \
  && tar -xf /tmp/blender.tar.xz -C /opt \
  && mv "/opt/blender-${BLENDER_VERSION}-linux-x64" /opt/blender \
  && rm /tmp/blender.tar.xz

ENV NODE_ENV=production \
    BLENDER_PATH=/opt/blender/blender \
    FFMPEG_PATH=/usr/bin/ffmpeg

# Install Node.js runtime
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl ca-certificates \
  && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
  && apt-get install -y --no-install-recommends nodejs \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/db/package.json packages/db/
COPY backend/package.json backend/
COPY worker/package.json worker/
COPY frontend/package.json frontend/

RUN npm ci --omit=dev

COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/packages/db/dist packages/db/dist
COPY --from=build /app/worker/dist worker/dist

CMD ["node", "worker/dist/index.js"]
