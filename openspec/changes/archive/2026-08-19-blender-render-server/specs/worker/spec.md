## ADDED Requirements

### Requirement: Independent worker process
The system SHALL run the render worker as a process separate from the Fastify backend, so backend failures, Blender crashes, or FFmpeg failures do not take down the API, and vice versa.

#### Scenario: Blender crash does not affect API
- **WHEN** Blender crashes during a render
- **THEN** Fastify and Redis continue running and the worker records the failure

#### Scenario: API restart does not stop worker
- **WHEN** the backend process restarts
- **THEN** in-flight worker consumption is unaffected and job state remains consistent in SQLite

### Requirement: BullMQ consumption
The system SHALL consume jobs from the shared `render` BullMQ queue and SHALL NOT couple a job to a specific worker instance, enabling multiple workers to consume the same queue.

#### Scenario: Multiple workers share a queue
- **WHEN** two worker instances consume the same `render` queue
- **THEN** jobs are distributed across them without job duplication

### Requirement: Concurrency limit
The system SHALL enforce a maximum number of simultaneous renders per worker as configured by `MAX_CONCURRENT_RENDERS` (default `1`).

#### Scenario: Respect concurrency limit
- **WHEN** more jobs are available than `MAX_CONCURRENT_RENDERS`
- **THEN** a worker processes at most the configured number simultaneously and queues the rest

### Requirement: Compute capability detection
The system SHALL detect the worker's compute capabilities (`CPU`, `NVIDIA CUDA`, `NVIDIA OptiX`) and report them; the worker SHALL render using CPU when no GPU is available.

#### Scenario: CPU-only worker
- **WHEN** no NVIDIA GPU is available
- **THEN** the worker reports compute mode `CPU` and renders on CPU

#### Scenario: GPU worker
- **WHEN** an NVIDIA GPU with the container toolkit is available
- **THEN** the worker reports CUDA/OptiX capability and can render on GPU

### Requirement: Worker registration and heartbeat
The system SHALL register the worker in SQLite and periodically update its `lastHeartbeat` and status (`online`/`offline`) while it is running.

#### Scenario: Worker heartbeat
- **WHEN** a worker is running
- **THEN** the system updates its heartbeat timestamp and marks it online

#### Scenario: Worker goes offline
- **WHEN** a worker stops sending heartbeats within the expected interval
- **THEN** the system marks it offline

### Requirement: Retry policy
The system SHALL retry failed jobs up to a configurable number of attempts (`JOB_RETRY_ATTEMPTS`, default `3`) and SHALL NOT retry indefinitely.

#### Scenario: Retry until limit
- **WHEN** a job fails due to a render error
- **THEN** the system retries it until the configured attempt limit is reached, then marks it `FAILED` permanently

#### Scenario: No infinite retries
- **WHEN** a job keeps failing
- **THEN** it is not retried beyond the configured maximum