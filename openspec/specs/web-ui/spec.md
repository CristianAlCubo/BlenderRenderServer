## Purpose

Provide a React frontend with dashboard, queue, job detail, upload, preview, and download.

## Requirements

### Requirement: Relative API consumption
The frontend SHALL call the API exclusively via relative paths beginning with `/api` (e.g., `fetch("/api/jobs")`), and SHALL NOT construct environment-specific absolute base URLs.

#### Scenario: No absolute base URL
- **WHEN** the frontend calls any API endpoint or WebSocket
- **THEN** it uses a relative `/api/...` path with no hostname or port

### Requirement: Real-time updates
The frontend SHALL subscribe to the `/api/ws` WebSocket and reflect job/worker events immediately, with automatic reconnection and REST resync on reconnect.

#### Scenario: Live progress updates
- **WHEN** a `job.progress` event is received
- **THEN** the UI updates the affected job's progress without a manual refresh

#### Scenario: Auto-reconnect
- **WHEN** the WebSocket connection drops
- **THEN** the UI reconnects and refetches REST data to reconcile state

### Requirement: Dashboard
The frontend SHALL provide a dashboard showing current rendering job(s), queued jobs, and summary statistics (rendering, queued, completed, failed counts).

#### Scenario: Show dashboard summary
- **WHEN** a user opens the dashboard
- **THEN** they see the active render, queue positions, and aggregate statistics

### Requirement: Queue view
The frontend SHALL display jobs with name, status, progress, queue position, current/total frames, worker, CPU/GPU mode, duration, and timestamp.

#### Scenario: Show queue entries
- **WHEN** a user opens the queue
- **THEN** each job shows its name, status badge, progress bar, queue position, frames, worker, compute mode, duration, and timestamp

### Requirement: Job detail view
The frontend SHALL provide a route `/jobs/:id` showing full job details (name, status, progress, frames, elapsed/ETA, compute mode, worker, logs, output, size, timestamps) with actions Cancel, Retry, Download, Preview, and Delete, only enabling actions valid for the current state.

#### Scenario: View job detail
- **WHEN** a user opens `/jobs/:id`
- **THEN** they see all job metadata and logs for that job

#### Scenario: State-appropriate actions
- **WHEN** a job is in a given state
- **THEN** only valid actions are shown (e.g., Cancel for active jobs, Retry for failed, Download/Preview only for completed)

### Requirement: Realtime terminal logs
The frontend SHALL display job logs in a terminal-style view that updates in realtime via WebSocket events.

#### Scenario: Live log tail
- **WHEN** new log events arrive
- **THEN** the log view appends them with timestamps in terminal style

### Requirement: Drag-and-drop upload UX
The frontend SHALL provide drag-and-drop upload accepting `.blend` and `.zip`, showing upload → validate → prepare → queued progress without blocking the browser.

#### Scenario: Drop a file
- **WHEN** a user drags and drops a `.blend` or `.zip`
- **THEN** the upload starts and the UI shows progress through validation, preparation, and queueing

### Requirement: Preview and download
The frontend SHALL allow previewing completed video/image outputs and downloading them via the API.

#### Scenario: Preview completed output
- **WHEN** a job is completed
- **THEN** the UI renders a video or image preview of the output

#### Scenario: Download output
- **WHEN** a user clicks download on a completed job
- **THEN** the output file is downloaded through the API endpoint

### Requirement: Polished responsive SaaS UI
The frontend SHALL provide a modern SaaS-quality interface with clear hierarchy, dark mode, responsive layout, skeleton loaders, empty states, error states, toasts, badges, progress bars, subtle animations, and clear navigation.

#### Scenario: Loading states
- **WHEN** data is loading
- **THEN** skeleton loaders are shown instead of blank screens

#### Scenario: Empty and error states
- **WHEN** there are no jobs or an error occurs
- **THEN** the UI shows an appropriate empty state or error state with recovery affordances
