## ADDED Requirements

### Requirement: BullMQ render queue
The system SHALL use a single BullMQ queue named `render` backed by Redis to dispatch jobs to workers.

#### Scenario: Enqueue job
- **WHEN** a job is validated and prepared
- **THEN** the system adds it to the `render` BullMQ queue

#### Scenario: Consume job
- **WHEN** a worker is available
- **THEN** it dequeues the next job from the `render` queue

### Requirement: SQLite as source of truth
The system SHALL persist all job state and history in SQLite and SHALL NOT rely solely on Redis for historical job status.

#### Scenario: Restart after Redis flush
- **WHEN** Redis is flushed or restarted
- **THEN** job history remains intact in SQLite and the UI can still display past jobs

### Requirement: State transition persistence
The system SHALL write job status/progress transitions to SQLite as they occur (from enqueue through completion/failure/cancel).

#### Scenario: Progress persisted
- **WHEN** a job progresses or changes state
- **THEN** the change is written to SQLite in addition to any queue signal

### Requirement: Bounded retry integration
The system SHALL configure BullMQ job options with a bounded attempts count derived from `JOB_RETRY_ATTEMPTS` and an appropriate backoff strategy.

#### Scenario: Retry policy applied
- **WHEN** a job is enqueued
- **THEN** the BullMQ job carries attempts and backoff options matching the configured retry policy

### Requirement: Cancellation propagation
The system SHALL remove/abort pending BullMQ jobs when their corresponding job is cancelled, and signal the active worker to stop any running process.

#### Scenario: Cancel queued job
- **WHEN** a job still in the queue is cancelled
- **THEN** the queued BullMQ job is aborted so it does not render

#### Scenario: Cancel active job
- **WHEN** a job currently being processed is cancelled
- **THEN** the active worker is notified and stops the render process