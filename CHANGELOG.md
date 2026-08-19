# Changelog

Todos los cambios notables de este proyecto se documentarán en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/),
y este proyecto se adhiere a [Semantic Versioning](https://semver.org/lang/es/).

## [0.1.0] - 2026-08-19

Primera versión del **Blender Render Server**: un servidor de renderizado autoalojado que permite subir proyectos `.blend`/`.zip`, encolarlos, renderizarlos con Blender en modo headless (CPU o GPU NVIDIA), codificar el video con FFmpeg, y previsualizar/descargar el resultado desde una interfaz web, todo desplegable con `docker compose up -d`.

### Added

- **Gestión de trabajos de renderizado (`jobs`)**: API REST bajo `/api/jobs` para crear, listar (con filtro por estado), consultar el detalle, cancelar, reintentar y descargar los resultados de un trabajo. Ciclo de vida completo de estados (`QUEUED` → `RENDERING` → `ENCODING` → `COMPLETED`/`FAILED`/`CANCELLED`) con progreso y logs asociados.
- **Subida de proyectos (`uploads`)**: subida multipart de archivos `.blend` y `.zip` con streaming a disco (sin buffering en memoria), validación de tipo de archivo, límite de tamaño configurable (`MAX_UPLOAD_SIZE`) y extracción segura de ZIP con protección contra path traversal y sanitización de nombres de archivo.
- **Motor de renderizado (`render-engine`)**: abstracción `RenderEngine` desacoplada (`render`, `cancel`, `getCapabilities`) con una implementación `BlenderRenderEngine` que ejecuta Blender headless mediante argumentos seguros (sin construir comandos de shell a partir de input de usuario), detecta el progreso por frame parseando la salida estándar, y codifica el video final con FFmpeg. Reporta las capacidades de cómputo soportadas (CPU / CUDA / OptiX).
- **Worker de renderizado (`worker`)**: proceso independiente del backend que consume la cola de BullMQ, permite múltiples workers sobre la misma cola, aplica un límite de renders concurrentes configurable (`MAX_CONCURRENT_RENDERS`), detecta el modo de cómputo disponible y aísla fallos de Blender/FFmpeg para que no afecten a la API.
- **Cola de trabajos (`queue`)**: cola `render` sobre Redis + BullMQ con política de reintentos, mientras que SQLite se mantiene como fuente de verdad del historial y estado de los trabajos (persistente incluso ante un reinicio o flush de Redis).
- **Eventos en tiempo real (`realtime`)**: endpoint WebSocket en `/api/ws` que emite eventos tipados de trabajos (`job.created`, `job.queued`, `job.started`, `job.progress`, `job.log`, `job.encoding`, `job.completed`, `job.failed`, `job.cancelled`) y de workers (`worker.online`, `worker.offline`), accesible tanto en desarrollo (proxy de Vite) como en producción (Nginx).
- **Persistencia (`storage`)**: esquema SQLite (vía Drizzle) con tablas `jobs`, `job_outputs`, `job_logs` y `workers`, y un layout de filesystem persistente bajo `/data` (`database/`, `projects/<job-id>/`, `renders/<job-id>/`) montado como volumen. Los resultados solo se sirven a través de la API; el directorio `/data` nunca se expone por HTTP.
- **Monitoreo (`monitoring`)**: endpoints `/api/health` (liveness) y `/api/ready` (readiness, verificando SQLite y Redis) para healthchecks de Docker, además de `/api/system/status` con métricas de CPU, memoria, disco y GPU (nombre/VRAM/uso) cuando está disponible.
- **Interfaz web (`web-ui`)**: frontend en React + Vite + TypeScript + shadcn/ui + Tailwind + TanStack Query que consume la API exclusivamente vía rutas relativas `/api/*`. Incluye dashboard con estadísticas y trabajo activo, vista de cola, detalle de trabajo con logs y progreso en vivo (con reconexión automática de WebSocket y resincronización vía REST), subida por drag-and-drop, y previsualización/descarga de resultados, con una UI responsiva en modo oscuro.
- **Despliegue (`deployment`)**: stack completo con Docker Compose (`nginx`, `frontend`, `backend`, `worker`, `redis`) desplegable con un único `docker compose up -d`. Nginx actúa como única puerta de entrada pública (puerto 80), enruta `/api/*` al backend (con soporte de upgrade de WebSocket) y sirve el frontend estático con fallback de SPA; backend, worker y Redis no se exponen al host. Perfil adicional (`docker-compose.gpu.yml`) para habilitar aceleración por GPU NVIDIA.

### Fixed

- Se corrigió la colisión de nombres DNS en la red de Dokploy renombrando y prefijando (`blender-`) todos los servicios del `docker-compose.yml`.
- Se ajustó el arranque para esperar a que el servicio `frontend` esté saludable antes de que Nginx comience a enrutar tráfico hacia él.
- Se eliminó el gate de healthcheck del frontend que bloqueaba el despliegue en el entorno de destino.
- Se removió la exposición del puerto externo de Nginx que no era necesaria en el `docker-compose.yml`.
