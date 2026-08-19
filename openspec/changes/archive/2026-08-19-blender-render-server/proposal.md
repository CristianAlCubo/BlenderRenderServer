## Why

Self-hosted Blender render farms today are either cloud services or heavyweight orchestrators like Flamenco. We need a small, self-hosted "Blender Render Server" that lets a single user (or small team) upload `.blend` / `.zip` projects through a modern web UI, enqueue them, execute Blender headless on CPU or NVIDIA GPU, encode video with FFmpeg, and preview/download results — all runnable via a single `docker compose up -d` on a Debian 13 server, with an architecture that can later scale to multiple workers.

## What Changes

Build a complete, end-to-end render server monorepo from scratch:

- **Backend** — Node.js + TypeScript + Fastify with modular architecture, JSON Schema / TypeBox request validation, REST API under `/api`, multipart uploads via `@fastify/multipart`, WebSocket realtime via `@fastify/websocket`.
- **Persistence** — SQLite (via Drizzle) as the source of truth for jobs, outputs, logs, and workers; Redis + BullMQ for the `render` queue only.
- **Worker** — an independent process that consumes BullMQ jobs, drives a pluggable `RenderEngine` (initial `BlenderRenderEngine`), spawns Blender headless and FFmpeg via safe argument arrays, streams stdout/stderr logs, and enforces a configurable concurrent-render limit.
- **Storage** — persistent local filesystem layout (`/data/{database,projects,renders}`) with safe ZIP extraction, path-traversal protection, and filename sanitization.
- **Frontend** — React + Vite + TypeScript + shadcn/ui + Tailwind + TanStack Query, consuming the API exclusively via relative `/api/*` routes; polished dashboard, queue, job detail, realtime logs/progress, drag-and-drop upload, preview and download.
- **Deployment** — Docker Compose from day one: `nginx` (public entry on :80), `frontend` (static build), `backend`, `worker`, `redis`; Nginx reverse-proxies `/api/*` to Fastify and `/*` to the static frontend with WebSocket upgrade; CPU and NVIDIA GPU (`docker-compose.gpu.yml`) profiles.
- **Observability** — health/readiness endpoints, worker heartbeats, and lightweight system monitoring.
- **Testing & docs** — route/schema/unit/integration tests plus a real end-to-end Blender render test, and a comprehensive README.

## Capabilities

### New Capabilities

- `jobs`: Job model, lifecycle states (QUEUED → … → COMPLETED/FAILED/CANCELLED), REST API (`/api/jobs`), outputs, logs, cancel/retry/download.
- `uploads`: Multipart `.blend` / `.zip` upload, size limits, filename sanitization, safe ZIP extraction, project validation/preparation.
- `render-engine`: Pluggable engine abstraction (`RenderEngine` → `BlenderRenderEngine`), Blender headless execution, frame progress detection, FFmpeg video encoding, CAPABILITIES (CPU / CUDA / OptiX).
- `worker`: Independent BullMQ consumer, concurrency limit, compute-mode detection and selection, crash isolation and failure handling.
- `queue`: Redis + BullMQ render queue, retry policy, state transitions synchronized back to SQLite.
- `realtime`: WebSocket endpoint `/api/ws` and job/worker event stream with client reconnection.
- `storage`: SQLite (Drizzle) schema and persistent filesystem layout; output access restricted through the API.
- `monitoring`: `/api/health`, `/api/ready`, and system/worker status endpoints.
- `web-ui`: React dashboard, queue view, job detail, realtime logs/progress, upload UX, preview/download, responsive dark-mode SaaS UI.
- `deployment`: Docker Compose topology, Nginx reverse proxy (incl. WebSocket), CPU and NVIDIA GPU deployment, persistent volumes, development workflow (Vite proxy).

### Modified Capabilities

<!-- No existing capabilities; greenfield project. -->

## Impact

- **New codebase**: monorepo (`backend/`, `frontend/`, `worker/` (shared), `packages/shared/`, `docker/`).
- **New stack**: Fastify, Drizzle + SQLite, BullMQ + Redis, React/Vite/shadcn, Blender CLI, FFmpeg, Nginx, Docker Compose.
- **Runtime dependencies**: Blender (CPU/GPU) and FFmpeg installed in worker image; NVIDIA Container Toolkit for GPU.
- **Public surface**: single Nginx origin on `:80`; Fastify, Redis, and worker never exposed to the host.
- **Persistence**: `/data` Docker volume/bind mount (database, projects, renders).
- **No breaking changes** — this is an initial implementation with no pre-existing consumers.