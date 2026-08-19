## Purpose

Stream job and worker events to clients over WebSocket for live progress and logs.

## Requirements

### Requirement: WebSocket endpoint
The system SHALL expose a WebSocket endpoint at `/api/ws` using `@fastify/websocket` for realtime events, reachable via a relative path through the Vite proxy (dev) and Nginx (production).

#### Scenario: Client connects
- **WHEN** a client opens a WebSocket to `/api/ws`
- **THEN** the connection is established and the client can receive typed realtime events

### Requirement: Job event stream
The system SHALL emit typed job events including `job.created`, `job.queued`, `job.started`, `job.progress`, `job.log`, `job.encoding`, `job.completed`, `job.failed`, and `job.cancelled`.

#### Scenario: Job event emitted
- **WHEN** a job's state changes
- **THEN** the corresponding `job.*` event is broadcast to subscribed clients

### Requirement: Worker event stream
The system SHALL emit worker events `worker.online` and `worker.offline` when worker presence changes.

#### Scenario: Worker comes online
- **WHEN** a worker registers and begins heartbeating
- **THEN** a `worker.online` event is broadcast

#### Scenario: Worker goes offline
- **WHEN** a worker's heartbeat lapses
- **THEN** a `worker.offline` event is broadcast

### Requirement: Reconnection and state resync
The system SHALL support automatic client reconnect, and the frontend SHALL resynchronize REST state (via TanStack Query) when the WebSocket reconnects.

#### Scenario: Reconnect and resync
- **WHEN** a client's WebSocket drops and reconnects
- **THEN** the client re-establishes the socket and refetches REST data to reconcile state

### Requirement: Cross-process event bus
The system SHALL propagate events from the worker process to the Fastify realtime broadcaster over a shared channel (e.g., Redis pub/sub) so events reach all connected clients regardless of which process produced them.

#### Scenario: Worker-produced event reaches UI
- **WHEN** the worker updates job progress
- **THEN** the event is published to the bus and broadcast by Fastify to connected clients
