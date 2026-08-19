# Blender Render Server

A self-hosted, end-to-end render server for Blender. Upload a `.blend` or `.zip`
project through a modern web UI, enqueue it, render it headless on CPU or
NVIDIA GPU, encode animations to MP4 with FFmpeg, and preview/download the
result — all behind a single Nginx origin.

## Features

- **Fastify + TypeScript** backend with modular architecture and JSON Schema validation
- **React + Vite + shadcn/ui** frontend with dark mode, realtime updates, drag & drop upload
- **SQLite** (via Drizzle) as the source of truth for jobs, outputs, logs, and workers
- **Redis + BullMQ** for the render queue (bounded retries, concurrency limits)
- **Blender** headless rendering with a pluggable `RenderEngine` abstraction
- **FFmpeg** video encoding with FPS/resolution detection
- **WebSocket** realtime (`/api/ws`) for progress, logs, and worker events
- **Nginx** reverse proxy as the sole public entry point (CPU and NVIDIA GPU profiles)

## Architecture

```
                    Internet / LAN
                           │
                           ▼
                     ┌──────────┐
                     │  NGINX   │
                     │  :80     │
                     └────┬─────┘
                          │
             ┌────────────┴────────────┐
             │                         │
             │ /api/*                  │ /*
             ▼                         ▼
       ┌──────────┐              ┌──────────┐
       │ Fastify  │              │ Frontend │
       │ Backend  │              │ Static   │
       └────┬─────┘              └──────────┘
            │
       ┌────┴─────┐
       │          │
    SQLite      Redis
                  │
               BullMQ
                  │
                  ▼
             Render Worker
                  │
            ┌─────┴─────┐
            │           │
         Blender      FFmpeg
```

The browser only ever talks to Nginx. Fastify, Redis, and the worker are
isolated inside the Docker network and are never exposed to the host.

## Quick start (CPU)

```bash
cp .env.example .env
docker compose up -d
```

Open `http://SERVER_IP/` and upload a project.

## NVIDIA GPU

1. Install the NVIDIA driver and the NVIDIA Container Toolkit:
   https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html
2. Start the stack with the GPU overlay:

```bash
cp .env.example .env
docker compose -f docker-compose.yml -f docker-compose.gpu.yml up -d
```

The worker detects its compute capabilities (`CPU`, `NVIDIA CUDA`, `NVIDIA
OptiX`) and reports them to the UI.

## Access

```text
http://SERVER_IP/
```

Everything is served under this single origin. There are no separate ports for
the API or frontend — requests to `/api/*` are proxied to Fastify and all other
paths serve the React app.

## Persistence

All persistent state lives under `/data`, mounted as a Docker volume:

```text
/data
├── database/
│   └── app.db          # SQLite (jobs, outputs, logs, workers)
├── projects/
│   └── <job-id>/       # uploaded scene, assets, logs/render.log
└── renders/
    └── <job-id>/       # frames/ and output.mp4 / output.png
```

To back up, snapshot the `render_data` Docker volume (or point `DATA_DIR` at a
bind mount). Jobs and outputs survive `docker compose restart`.

## Configuration

Copy `.env.example` to `.env` and adjust. Key variables:

| Variable | Default | Description |
| --- | --- | --- |
| `BACKEND_PORT` | `3000` | Fastify port (internal only) |
| `DATABASE_URL` | `/data/database/app.db` | SQLite path |
| `REDIS_URL` | `redis://blender-redis:6379` | BullMQ Redis connection |
| `DATA_DIR` | `/data` | Persistent data root |
| `BLENDER_PATH` | `/opt/blender/blender` | Blender executable |
| `FFMPEG_PATH` | `/usr/bin/ffmpeg` | FFmpeg executable |
| `MAX_UPLOAD_SIZE` | `10GB` | Max upload size |
| `MAX_CONCURRENT_RENDERS` | `1` | Concurrent renders per worker |
| `DEFAULT_RENDER_MODE` | `CPU` | Default render mode |
| `JOB_RETRY_ATTEMPTS` | `3` | Max retries per job |

## Development

Run Redis only in Docker, then run backend, worker, and frontend natively:

```bash
# 1. Start Redis
docker compose up -d blender-redis

# 2. Backend (Fastify on :3000)
npm install
npm run dev:backend

# 3. Worker
REDIS_URL=redis://localhost:6379 DATA_DIR=/data npm run dev:worker

# 4. Frontend (Vite on :5173)
npm run dev:frontend
```

### Networking

**Development:**

```text
Browser
  ↓
Vite :5173
  ↓ /api/* and /api/ws (proxy)
Fastify :3000
```

Vite proxies `/api` and `/api/ws` to the backend (see `frontend/vite.config.ts`).
The React code always uses relative `/api/...` paths — it never knows the
backend host or port.

**Production:**

```text
Browser
  ↓
Nginx :80
  ├── /api/* → Fastify :3000
  └── /*     → React static files
```

## API

All routes are under `/api`:

```text
POST   /api/uploads            multipart upload (.blend / .zip)
POST   /api/jobs               create job from an upload
GET    /api/jobs               list jobs (filter by ?status=)
GET    /api/jobs/:id           job detail
POST   /api/jobs/:id/cancel    cancel a queued/active job
POST   /api/jobs/:id/retry     retry a failed/cancelled job
GET    /api/jobs/:id/logs      render logs
GET    /api/jobs/:id/output    download/preview output
DELETE /api/jobs/:id           delete job + files
GET    /api/workers            worker list
GET    /api/system/status      CPU/RAM/disk/GPU metrics
GET    /api/health             liveness
GET    /api/ready              readiness (SQLite + Redis)
GET    /api/ws                 WebSocket realtime events
```

Realtime events: `job.created`, `job.queued`, `job.started`, `job.progress`,
`job.log`, `job.encoding`, `job.completed`, `job.failed`, `job.cancelled`,
`worker.online`, `worker.offline`.

## Monorepo layout

```text
backend/          Fastify API + Drizzle + BullMQ producer
worker/           BullMQ consumer + BlenderRenderEngine + FFmpeg
frontend/         React + Vite + shadcn/ui + TanStack Query
packages/shared/  shared types, enums, schemas, events
packages/db/      Drizzle schema, migrations, repositories
docker/           Dockerfiles + nginx configs
```

## Testing

```bash
# Unit / integration tests (SQLite in-memory, mocked Redis/queue)
npm run test -w @render-server/backend

# End-to-end test (requires Redis + Blender + FFmpeg + built worker)
npm run build -w @render-server/shared
npm run build -w @render-server/worker
npm run test:e2e -w @render-server/backend
```

The e2e test performs a real `upload → create → enqueue → render → encode →
download` cycle against a small generated `.blend` scene.

## Security notes

Self-hosted and private by design, but the code enforces:

- filename sanitization and safe ZIP extraction (path traversal, absolute paths,
  and symlink protection)
- upload size limits and streaming (no in-memory buffering of large files)
- subprocess invocations via argument arrays (no shell string concatenation)
- filesystem access restricted to per-job directories under `/data`
- no direct exposure of `/data`, Fastify, Redis, or the worker

Authentication is intentionally out of scope; the backend is structured so it
can be added later (all routes are thin handlers delegating to services).
