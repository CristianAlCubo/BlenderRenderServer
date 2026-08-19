## ADDED Requirements

### Requirement: Docker Compose services
The system SHALL provide a Docker Compose stack with services `nginx`, `frontend`, `backend`, `worker`, and `redis`, such that `docker compose up -d` starts the full application.

#### Scenario: Start full stack
- **WHEN** an operator runs `docker compose up -d`
- **THEN** nginx, frontend, backend, worker, and redis start and the app is reachable at `http://SERVER_IP/`

### Requirement: Nginx as sole public entry
The system SHALL expose only the Nginx service on a host HTTP port (80) and SHALL NOT expose backend, worker, or redis ports to the host in production.

#### Scenario: Only Nginx public
- **WHEN** the production stack is running
- **THEN** only Nginx is reachable from the host network; backend, redis, and worker are internal only

### Requirement: Nginx routing
The system SHALL configure Nginx to proxy `/api/*` to the Fastify backend (preserving the `/api` path) and to serve the frontend static build for all other paths with SPA fallback to `index.html`.

#### Scenario: API proxied to backend
- **WHEN** a client requests `/api/jobs`
- **THEN** Nginx proxies the request to the backend container, preserving the path

#### Scenario: SPA fallback
- **WHEN** a client requests a client-side route (e.g., `/jobs/123`)
- **THEN** Nginx serves `index.html` so React Router can handle it

### Requirement: Nginx WebSocket support
The system SHALL configure Nginx to support WebSocket upgrades for `/api/ws`, forwarding upgrade headers to the backend.

#### Scenario: WebSocket through Nginx
- **WHEN** a client opens a WebSocket to `/api/ws`
- **THEN** Nginx upgrades the connection and proxies it to Fastify

### Requirement: Nginx upload and proxy headers
The system SHALL set `client_max_body_size` consistent with `MAX_UPLOAD_SIZE` and forward `X-Real-IP`, `X-Forwarded-For`, and `X-Forwarded-Proto` headers.

#### Scenario: Upload size allowed
- **WHEN** a client uploads a file within the configured limit
- **THEN** Nginx accepts it and forwards the request with proper headers

### Requirement: Persistent volumes
The system SHALL mount a persistent volume/bind mount for `/data` so database, projects, and renders survive container recreation.

#### Scenario: Data survives restart
- **WHEN** the stack is restarted
- **THEN** jobs and outputs stored under `/data` persist

### Requirement: CPU deployment
The system SHALL support CPU-only rendering out of the box with the default compose file.

#### Scenario: CPU render works
- **WHEN** running the default compose stack on a CPU-only host
- **THEN** jobs render successfully on CPU

### Requirement: NVIDIA GPU deployment
The system SHALL provide `docker-compose.gpu.yml` enabling NVIDIA GPU rendering using the NVIDIA Container Toolkit, without modifying the application, and without CPU-only hacks.

#### Scenario: GPU overlay
- **WHEN** an operator runs the compose files with the GPU overlay on an NVIDIA host
- **THEN** the worker gains GPU access and reports CUDA/OptiX capability

### Requirement: Environment configuration
The system SHALL ship a `.env.example` with the documented variables (`NODE_ENV`, `BACKEND_PORT`, `DATABASE_URL`, `REDIS_URL`, `DATA_DIR`, `BLENDER_PATH`, `FFMPEG_PATH`, `MAX_UPLOAD_SIZE`, `MAX_CONCURRENT_RENDERS`, `DEFAULT_RENDER_MODE`, `JOB_RETRY_ATTEMPTS`) and SHALL NOT hardcode critical paths.

#### Scenario: Configurable paths
- **WHEN** an operator sets values in `.env`
- **THEN** the backend, worker, and storage use those configured paths and limits

### Requirement: Development workflow
The system SHALL support local development where only Redis runs in Docker (`docker compose up -d redis`) while backend, worker, and frontend run natively, with the Vite dev server proxying `/api` and `/api/ws` to Fastify.

#### Scenario: Vite proxy
- **WHEN** the Vite dev server is running
- **THEN** requests to `/api/*` and `/api/ws` are proxied to the configured Fastify backend port