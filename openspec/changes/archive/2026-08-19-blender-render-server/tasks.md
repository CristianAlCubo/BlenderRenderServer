## 1. Monorepo & Project Scaffolding

- [x] 1.1 Initialize npm workspaces monorepo with `backend`, `worker`, `frontend`, `packages/shared`, and `docker` directories
- [x] 1.2 Configure root TypeScript project references and shared `tsconfig` base
- [x] 1.3 Create `packages/shared` with shared enums/types (`JobStatus`, `ComputeMode`, `OutputType`, `WorkerStatus`, API DTOs)
- [x] 1.4 Scaffold Fastify backend (`app.ts`, `server.ts`, `config/`, `plugins/`, `modules/`, `queue/`, `render/`, `storage/`, `realtime/`)
- [x] 1.5 Scaffold React + Vite + TypeScript frontend with shadcn/ui, Tailwind, Lucide, TanStack Query, React Router
- [x] 1.6 Add `.env.example` with all documented environment variables
- [x] 1.7 Add root `package.json` scripts, linting, and formatting configuration

## 2. Backend Foundation (Fastify)

- [x] 2.1 Implement `config` module loading env vars (port, DB URL, Redis URL, DATA_DIR, paths, limits) with sensible defaults
- [x] 2.2 Register Fastify plugins: `@fastify/cors` (restricted), `@fastify/multipart`, `@fastify/websocket`
- [x] 2.3 Add Fastify error handler and structured JSON error responses
- [x] 2.4 Implement `GET /api/health` and `GET /api/ready` (checks SQLite + Redis)
- [x] 2.5 Set up Drizzle with SQLite and define `jobs`, `job_outputs`, `job_logs`, `workers` tables + migrations
- [x] 2.6 Set up BullMQ producer with the `render` queue and Redis connection

## 3. Storage & Persistence Layer

- [x] 3.1 Implement `storage` module with `/data` layout helpers (`database/`, `projects/<id>/`, `renders/<id>/`)
- [x] 3.2 Implement filename sanitization and managed-path resolution (no user absolute paths)
- [x] 3.3 Implement safe ZIP extraction with path traversal, absolute path, and symlink protection
- [x] 3.4 Implement repository modules (jobs, outputs, logs, workers) with Drizzle CRUD

## 4. Jobs Module

- [x] 4.1 Define jobs JSON schemas (params/querystring/body/response) for all job routes
- [x] 4.2 Implement `POST /api/jobs` (create from uploaded project, insert row, enqueue)
- [x] 4.3 Implement `GET /api/jobs` with status filtering and ordering
- [x] 4.4 Implement `GET /api/jobs/:id`
- [x] 4.5 Implement `POST /api/jobs/:id/cancel` (abort queued job / signal active worker)
- [x] 4.6 Implement `POST /api/jobs/:id/retry`
- [x] 4.7 Implement `GET /api/jobs/:id/logs`
- [x] 4.8 Implement `GET /api/jobs/:id/output` (stream file, restrict unfinished jobs)
- [x] 4.9 Implement `DELETE /api/jobs/:id` (remove record + files)
- [x] 4.10 Implement job lifecycle state transitions persisted to SQLite

## 5. Upload Module

- [x] 5.1 Implement multipart upload route with streaming to disk (`.blend`/`.zip`)
- [x] 5.2 Implement upload type validation (reject unsupported extensions)
- [x] 5.3 Enforce `MAX_UPLOAD_SIZE` limit with `413` on overflow and cleanup
- [x] 5.4 Implement project preparation pipeline: store → validate → prepare → enqueue

## 6. Queue Integration

- [x] 6.1 Wire job enqueue with BullMQ options (attempts/backoff from `JOB_RETRY_ATTEMPTS`)
- [x] 6.2 Implement state transition persistence on queue events (progress, started, completed, failed, cancelled)
- [x] 6.3 Implement cancellation propagation (abort queued BullMQ jobs, signal active)

## 7. Render Engine

- [x] 7.1 Define `RenderEngine` interface (`render`, `cancel`, `getCapabilities`) and `RenderResult`/`RenderCapabilities` types
- [x] 7.2 Implement `BlenderRenderEngine` with safe `spawn` argument-array invocation (`blender -b <scene> -a`)
- [x] 7.3 Implement Blender stdout/stderr capture and log streaming
- [x] 7.4 Implement frame/progress detection from Blender output
- [x] 7.5 Implement render failure detection (non-zero exit, stderr markers)
- [x] 7.6 Implement FFmpeg video encoding (`output.mp4`) as a separate process
- [x] 7.7 Implement FPS/resolution detection where possible (avoid hardcoded 30 FPS)
- [x] 7.8 Implement output registration in `job_outputs` (type, filename, path, MIME, size)

## 8. Worker

- [x] 8.1 Implement standalone worker entrypoint consuming the `render` BullMQ queue
- [x] 8.2 Enforce `MAX_CONCURRENT_RENDERS` concurrency limit
- [x] 8.3 Implement compute capability detection (CPU / CUDA / OptiX)
- [x] 8.4 Implement worker registration + heartbeat to SQLite
- [x] 8.5 Implement cancel handling (terminate Blender/FFmpeg child processes)
- [x] 8.6 Implement bounded retry and permanent failure after attempts exhausted

## 9. Realtime

- [x] 9.1 Implement WebSocket route `/api/ws` with `@fastify/websocket`
- [x] 9.2 Implement typed event emission (`job.*`, `worker.*`)
- [x] 9.3 Implement cross-process event bus (Redis pub/sub) bridging worker → Fastify broadcaster
- [x] 9.4 Implement worker online/offline detection and events

## 10. System Monitoring

- [x] 10.1 Implement `GET /api/system/status` (CPU, memory, disk; GPU name/VRAM/util when present)
- [x] 10.2 Implement `GET /api/workers` (name, status, compute mode, Blender version, heartbeat, current job)

## 11. Frontend Foundation

- [x] 11.1 Set up API client using relative `/api/*` paths only (no absolute base URL)
- [x] 11.2 Configure Vite proxy for `/api` and `/api/ws` (ws:true) to Fastify
- [x] 11.3 Implement theme (dark mode), Tailwind base styles, and layout/sidebar navigation
- [x] 11.4 Implement WebSocket client with auto-reconnect and TanStack Query resync

## 12. Frontend Features

- [x] 12.1 Implement dashboard with summary stats (rendering/queued/completed/failed) and active render
- [x] 12.2 Implement queue view with per-job name, status badge, progress bar, position, frames, worker, compute mode, duration, timestamp
- [x] 12.3 Implement job detail route `/jobs/:id` with metadata, logs, and state-aware actions (Cancel/Retry/Download/Preview/Delete)
- [x] 12.4 Implement realtime terminal-style log view
- [x] 12.5 Implement drag-and-drop upload with upload→validate→prepare→queued progress
- [x] 12.6 Implement preview (video/image) and download of outputs
- [x] 12.7 Implement skeleton loaders, empty states, error states, and toasts
- [x] 12.8 Polish responsive design, spacing, hierarchy, badges, and animations

## 13. Docker & Nginx Deployment

- [x] 13.1 Write backend Dockerfile (multi-stage, Node + TypeScript build)
- [x] 13.2 Write worker Dockerfile (Node + Blender + FFmpeg installed)
- [x] 13.3 Write frontend build + static assets into Nginx image (multi-stage)
- [x] 13.4 Write `docker/nginx/default.conf` (route `/api/*` → backend, `/*` → SPA fallback, WS upgrade, proxy headers, `client_max_body_size`)
- [x] 13.5 Write `docker-compose.yml` (nginx, frontend, backend, worker, redis) with `/data` volume and no exposed backend/redis/worker ports
- [x] 13.6 Add Docker healthchecks using `/api/health` and `/api/ready`
- [x] 13.7 Verify `docker compose up -d` serves the app at `http://SERVER_IP/`

## 14. GPU Support

- [x] 14.1 Write `docker-compose.gpu.yml` with NVIDIA runtime/device passthrough for the worker
- [x] 14.2 Document NVIDIA driver + Container Toolkit setup and GPU compose invocation
- [x] 14.3 Verify worker reports CUDA/OptiX capability and renders on GPU

## 15. Testing

- [x] 15.1 Add backend unit/integration tests for Fastify routes and JSON schemas
- [x] 15.2 Add tests for jobs service, SQLite repositories, and state transitions
- [x] 15.3 Add tests for uploads (type validation, size limit, sanitization, safe ZIP extraction)
- [x] 15.4 Add tests for BullMQ queue/retry/cancellation behavior
- [x] 15.5 Add tests for worker concurrency and Blender process handling
- [x] 15.6 Add tests for logs, output registration, and realtime event emission
- [x] 15.7 Add frontend state/component tests (loading, empty, error states)
- [x] 15.8 Add end-to-end test: upload `test.blend` → create → enqueue → render → encode → download

## 16. Documentation

- [x] 16.1 Write README with architecture diagram and full stack description
- [x] 16.2 Document CPU install (`cp .env.example .env && docker compose up -d`)
- [x] 16.3 Document NVIDIA install and GPU compose usage
- [x] 16.4 Document access (`http://SERVER_IP/`), persistence (`/data`), and backup/restore
- [x] 16.5 Document development workflow (Vite, Fastify, Vite proxy, Redis, worker, Docker)
- [x] 16.6 Document networking (dev Vite proxy vs production Nginx) and API endpoints

## 17. Verification & Polish

- [x] 17.1 Run full local end-to-end render after each phase and fix issues
- [x] 17.2 Verify restart persistence (job + output survive `docker compose` restart)
- [x] 17.3 Verify no backend/redis/worker ports exposed to host
- [x] 17.4 Final UI polish pass and error-handling review
