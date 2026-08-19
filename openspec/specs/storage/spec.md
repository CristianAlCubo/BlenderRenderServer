## Purpose

Manage persistent filesystem layout and the SQLite schema for projects, renders, outputs, logs, and workers.

## Requirements

### Requirement: Persistent filesystem layout
The system SHALL use a local filesystem under `/data` with a fixed layout: `database/app.db`, `projects/<job-id>/` (scene, assets, logs), and `renders/<job-id>/` (frames and outputs). All persistent state SHALL be volume/bind-mounted and SHALL NOT live in ephemeral container storage.

#### Scenario: Persistent storage
- **WHEN** the Docker stack is restarted
- **THEN** database files, project files, and render outputs remain available under `/data`

### Requirement: SQLite schema
The system SHALL define SQLite tables (`jobs`, `job_outputs`, `job_logs`, `workers`) with the fields specified in the data model, via Drizzle migrations.

#### Scenario: Schema provisioned
- **WHEN** the backend starts
- **THEN** it applies pending Drizzle migrations so all tables exist and are queryable

### Requirement: Output access control
The system SHALL serve render outputs only through the API endpoint and SHALL NOT expose the `/data` directory over HTTP.

#### Scenario: Direct data access denied
- **WHEN** a client attempts to access `/data/...` via HTTP
- **THEN** the request does not resolve to the storage directory (no route maps it)

#### Scenario: Output via API
- **WHEN** a client requests the job output through the authorized API endpoint
- **THEN** the file is streamed with an appropriate response

### Requirement: Big-file streaming
The system SHALL stream large output files and uploads to/from disk rather than loading them fully into memory.

#### Scenario: Large file streaming
- **WHEN** downloading a large output or receiving a large upload
- **THEN** the system streams the bytes without buffering the whole file in memory

### Requirement: Sanitized managed paths
The system SHALL always resolve files under managed `/data` paths using the persisted job directory (never user-supplied absolute paths) to prevent arbitrary filesystem access.

#### Scenario: Cannot escape data root
- **WHEN** any file operation is performed for a job
- **THEN** the resolved path remains within the job's managed directory under `/data`
