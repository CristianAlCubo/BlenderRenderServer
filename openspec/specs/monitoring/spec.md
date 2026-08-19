## Purpose

Expose health, readiness, and system/worker status endpoints.

## Requirements

### Requirement: Liveness endpoint
The system SHALL expose `GET /api/health` returning `200` while the HTTP process is alive, for use by Docker healthchecks.

#### Scenario: Healthy process
- **WHEN** a client or Docker healthcheck requests `/api/health`
- **THEN** the system returns `200` with a status body

### Requirement: Readiness endpoint
The system SHALL expose `GET /api/ready` that verifies critical dependencies (SQLite and Redis) and returns `200` only when they are reachable.

#### Scenario: Dependencies ready
- **WHEN** both SQLite and Redis are reachable and `/api/ready` is requested
- **THEN** the system returns `200`

#### Scenario: Dependency unavailable
- **WHEN** SQLite or Redis is unavailable and `/api/ready` is requested
- **THEN** the system returns a non-2xx status indicating not ready

### Requirement: System status
The system SHALL expose `GET /api/system/status` returning lightweight host metrics including CPU usage, memory, disk free space, and (when present) GPU name/VRAM/utilisation.

#### Scenario: Report system status
- **WHEN** a client requests `/api/system/status`
- **THEN** the system returns CPU, memory, disk, and (if available) GPU metrics

### Requirement: Worker listing
The system SHALL expose `GET /api/workers` returning registered workers with their name, status, compute mode, Blender version, last heartbeat, and current job.

#### Scenario: List workers
- **WHEN** a client requests `/api/workers`
- **THEN** the system returns the list of known workers with live status and capability info

### Requirement: Docker healthcheck integration
The system SHALL be configured with Docker healthchecks that use `/api/health` (and `/api/ready` where appropriate).

#### Scenario: Container healthcheck
- **WHEN** Docker runs its healthcheck against the backend
- **THEN** it uses the health/ready endpoints to determine container health
