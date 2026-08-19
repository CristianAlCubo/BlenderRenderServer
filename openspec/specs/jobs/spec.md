## Purpose

Manage render jobs end-to-end: lifecycle states, REST API, outputs, logs, and cancel/retry/download operations.

## Requirements

### Requirement: Create render job
The system SHALL accept a `POST /api/jobs` request to create a job from an uploaded project. The route SHALL validate the request body and create a job record with an initial status of `QUEUED`, then enqueue it for rendering.

#### Scenario: Create job from uploaded project
- **WHEN** a client posts a valid job payload referencing an uploaded `.blend` or `.zip` project
- **THEN** the system creates a job with a generated ID, persisted in SQLite, and returns the job resource with `status: "QUEUED"`

#### Scenario: Reject invalid job payload
- **WHEN** a client posts a job payload that fails schema validation (missing or malformed fields)
- **THEN** the system responds with `400` and a structured error body, and no job is created

### Requirement: List jobs
The system SHALL expose `GET /api/jobs` with filtering by status and stable ordering (newest first), returning a list of job resources with their current progress.

#### Scenario: List all jobs
- **WHEN** a client requests `GET /api/jobs`
- **THEN** the system returns an array of jobs ordered by creation time descending

#### Scenario: Filter jobs by status
- **WHEN** a client requests `GET /api/jobs?status=RENDERING`
- **THEN** the system returns only jobs whose status is `RENDERING`

### Requirement: Retrieve job detail
The system SHALL expose `GET /api/jobs/:id` returning the full job resource including outputs and current progress fields.

#### Scenario: Fetch existing job
- **WHEN** a client requests `GET /api/jobs/:id` for an existing job
- **THEN** the system returns the job with all fields (name, status, progress, frames, compute mode, worker, timestamps, error)

#### Scenario: Fetch missing job
- **WHEN** a client requests `GET /api/jobs/:id` for an unknown ID
- **THEN** the system responds with `404`

### Requirement: Cancel job
The system SHALL expose `POST /api/jobs/:id/cancel` to cancel a queued or active job. Cancellation SHALL request the running Blender/FFmpeg process to stop and transition the job to `CANCELLED`.

#### Scenario: Cancel an active job
- **WHEN** a client cancels a job that is currently rendering
- **THEN** the system signals the render process to stop and transitions the job to `CANCELLED`

#### Scenario: Cancel an already-finalized job
- **WHEN** a client cancels a job already in `COMPLETED`, `FAILED`, or `CANCELLED`
- **THEN** the system responds with `409` and does not change the job

### Requirement: Retry failed job
The system SHALL expose `POST /api/jobs/:id/retry` to re-enqueue a job that has `FAILED` or `CANCELLED`, resetting its state to `QUEUED`.

#### Scenario: Retry a failed job
- **WHEN** a client retries a job in `FAILED`
- **THEN** the system resets progress, clears the error, sets status to `QUEUED`, and enqueues it again

#### Scenario: Retry a non-retryable job
- **WHEN** a client retries a job not in `FAILED` or `CANCELLED`
- **THEN** the system responds with `409`

### Requirement: Retrieve job logs
The system SHALL expose `GET /api/jobs/:id/logs` returning the accumulated render log content, sourced from storage and structured log entries rather than a single SQLite blob.

#### Scenario: Read logs for an existing job
- **WHEN** a client requests logs for an existing job
- **THEN** the system returns the log lines (with timestamps/levels) for that job

#### Scenario: Read logs for an unknown job
- **WHEN** a client requests logs for an unknown job
- **THEN** the system responds with `404`

### Requirement: Retrieve job output
The system SHALL expose `GET /api/jobs/:id/output` to stream the rendered output file (MP4 or image). The system SHALL NOT expose the raw `/data` directory over HTTP.

#### Scenario: Download completed output
- **WHEN** a client requests the output of a `COMPLETED` job
- **THEN** the system streams the output file with the correct `Content-Type` and appropriate download headers

#### Scenario: Request output of an unfinished job
- **WHEN** a client requests the output of a job not yet `COMPLETED`
- **THEN** the system responds with `404` (or `409`) and does not stream partial frames

### Requirement: Delete job
The system SHALL expose `DELETE /api/jobs/:id` to delete a job and its associated workspace/output data.

#### Scenario: Delete an existing job
- **WHEN** a client deletes an existing job
- **THEN** the system removes the job record and its project/render files and returns `204`

#### Scenario: Delete a missing job
- **WHEN** a client deletes an unknown job
- **THEN** the system responds with `404`

### Requirement: Job lifecycle states
The system SHALL represent job state with the ordered states `QUEUED`, `PREPARING`, `RENDERING`, `ENCODING`, `COMPLETED`, `FAILED`, `CANCELLED` and SHALL persist every transition to SQLite.

#### Scenario: Normal lifecycle
- **WHEN** a job progresses through the pipeline
- **THEN** its status transitions in order `QUEUED` → `PREPARING` → `RENDERING` → `ENCODING` → `COMPLETED`, with each transition persisted

#### Scenario: Failure transition
- **WHEN** a render or encode step fails
- **THEN** the job transitions to `FAILED` and an error message is persisted

### Requirement: Output registration
The system SHALL record each render output (video or image) in the `job_outputs` table with type, filename, path, MIME type, and size.

#### Scenario: Single-output job
- **WHEN** a job completes producing an output file
- **THEN** the system stores a `job_outputs` row describing the file and its metadata
