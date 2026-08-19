## Purpose

Provide a pluggable render engine abstraction with a Blender implementation and FFmpeg video encoding.

## Requirements

### Requirement: RenderEngine abstraction
The system SHALL define a `RenderEngine` interface with `render(job)`, `cancel(jobId)`, and `getCapabilities()`, allowing multiple engine implementations to be plugged into the worker without changing worker logic.

#### Scenario: Pluggable engine
- **WHEN** the worker processes a render job
- **THEN** it invokes the configured `RenderEngine` implementation through the common interface

#### Scenario: Engine capabilities
- **WHEN** the worker starts
- **THEN** it queries `getCapabilities()` and reports supported compute modes (CPU / CUDA / OptiX)

### Requirement: Blender headless execution
The system SHALL execute Blender via its CLI in background mode using a safe argument array (e.g., `spawn('blender', ['-b', scene, '-a'])`) and SHALL NOT construct shell command strings from user input.

#### Scenario: Render a scene
- **WHEN** the `BlenderRenderEngine` renders a job
- **THEN** it spawns Blender with an argument array referencing the scene file and animation flags

#### Scenario: No shell string execution
- **WHEN** a job renders
- **THEN** no shell is invoked with concatenated user-provided strings; all arguments are passed as array elements

### Requirement: Progress and frame detection
The system SHALL parse Blender stdout to detect per-frame progress and SHALL update the job's `currentFrame` and `progress` fields as frames complete.

#### Scenario: Frame progress updates
- **WHEN** Blender reports completed frames (`Fra: X`)
- **THEN** the system updates the job's current frame and overall progress

### Requirement: Log stream capture
The system SHALL capture Blender's stdout and stderr, emit structured log events in realtime, and persist the full log to `/data/projects/<job-id>/logs/render.log`.

#### Scenario: Capture stdout/stderr
- **WHEN** Blender writes to stdout or stderr
- **THEN** the system records the lines as log entries and streams them to subscribed clients

### Requirement: Render failure detection
The system SHALL detect render failures via non-zero exit codes and/or error markers in stderr, failing the job with a persisted error message.

#### Scenario: Blender exits non-zero
- **WHEN** the Blender process exits with a non-zero code
- **THEN** the system marks the job `FAILED` and records the relevant error output

#### Scenario: Blender completes successfully
- **WHEN** the Blender process exits with code `0`
- **THEN** the system proceeds to the encoding stage (or marks completion for image outputs)

### Requirement: Image output type
The system SHALL support `IMAGE` output, where the render produces one or more image frames (e.g., PNG) recorded as output.

#### Scenario: Single image render
- **WHEN** a job is configured for `IMAGE` output and Blender finishes
- **THEN** the system registers the resulting image in `job_outputs`

### Requirement: Video output with FFmpeg
The system SHALL support `VIDEO` output by rendering frames with Blender and then encoding them to MP4 with FFmpeg as a separate process, detecting frame rate and resolution when available rather than assuming 30 FPS.

#### Scenario: Encode animation to MP4
- **WHEN** an animation job finishes rendering frames
- **THEN** the system runs FFmpeg as an independent process to produce `output.mp4` and registers it in `job_outputs`

#### Scenario: FFmpeg failure
- **WHEN** FFmpeg exits non-zero
- **THEN** the job transitions to `FAILED` with an encoding error message

### Requirement: Cancel render process
The system SHALL terminate the spawned Blender and FFmpeg child processes when a job is cancelled.

#### Scenario: Cancel kills render process
- **WHEN** a job is cancelled during rendering
- **THEN** the running Blender/FFmpeg subprocess is terminated and the job transitions to `CANCELLED`
