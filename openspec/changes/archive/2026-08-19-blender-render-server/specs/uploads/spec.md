## ADDED Requirements

### Requirement: Multipart upload
The system SHALL accept multipart uploads of `.blend` and `.zip` files using `@fastify/multipart`, streaming the file to disk rather than buffering it in memory.

#### Scenario: Upload a .blend file
- **WHEN** a client uploads a `.blend` file with a valid `Content-Type`
- **THEN** the system streams it to a per-job directory on disk and returns the stored project reference

#### Scenario: Upload a .zip file
- **WHEN** a client uploads a `.zip` file
- **THEN** the system streams it to a per-job directory on disk for later safe extraction

### Requirement: Upload type validation
The system SHALL reject uploads whose extension (or detected type) is not `.blend` or `.zip`.

#### Scenario: Reject unsupported type
- **WHEN** a client uploads a file with an unsupported extension (e.g., `.exe` or `.txt`)
- **THEN** the system responds with `400` and does not store the file

### Requirement: Upload size limit
The system SHALL enforce a maximum upload size configured via `MAX_UPLOAD_SIZE` and reject files exceeding it.

#### Scenario: Exceed size limit
- **WHEN** a client uploads a file larger than `MAX_UPLOAD_SIZE`
- **THEN** the system responds with `413` and removes any partial file

#### Scenario: Within size limit
- **WHEN** a client uploads a file under `MAX_UPLOAD_SIZE`
- **THEN** the system accepts and stores it

### Requirement: Filename sanitization
The system SHALL sanitize uploaded filenames to remove path separators, `..`, and control characters, storing files under safe generated names/namespaces.

#### Scenario: Malicious filename
- **WHEN** an upload contains a filename with `../` or absolute path components
- **THEN** the system strips/derived a safe name and stores it within the job's sandbox directory

### Requirement: Safe ZIP extraction
The system SHALL extract uploaded ZIP archives into a job workspace while preventing path traversal, absolute path escapes, and dangerous symlinks. The system SHALL locate the `.blend` file within the archive and validate the resulting project before enqueueing.

#### Scenario: Path traversal in ZIP
- **WHEN** a ZIP contains entries with `../` or absolute paths
- **THEN** the system rejects or safely re-roots them inside the workspace, refusing writes outside the workspace

#### Scenario: ZIP contains a .blend
- **WHEN** a ZIP is safely extracted and contains a `.blend` file
- **THEN** the system identifies the entry `.blend` as the scene file and prepares the render

#### Scenario: ZIP without a .blend
- **WHEN** a ZIP is extracted and contains no `.blend` file
- **THEN** the system fails the job with a validation error and does not enqueue it

#### Scenario: Dangerous symlink in ZIP
- **WHEN** a ZIP contains a symlink pointing outside the workspace
- **THEN** the system rejects the entry and fails validation

### Requirement: Project preparation pipeline
The system SHALL process an uploaded project through the steps: store → validate → prepare workspace → enqueue, reporting the current stage to the client.

#### Scenario: Successful preparation
- **WHEN** a valid project is uploaded and passes validation
- **THEN** the job is prepared and enqueued with status `QUEUED`

#### Scenario: Preparation failure
- **WHEN** project validation or preparation fails
- **THEN** the job transitions to `FAILED` with an explanatory error and is not enqueued