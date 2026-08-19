export const jobParamsSchema = {
  type: "object",
  required: ["id"],
  properties: {
    id: { type: "string", minLength: 1 },
  },
  additionalProperties: false,
} as const;

export const listJobsQuerySchema = {
  type: "object",
  properties: {
    status: {
      type: "string",
      enum: ["QUEUED", "PREPARING", "RENDERING", "ENCODING", "COMPLETED", "FAILED", "CANCELLED"],
    },
    limit: { type: "integer", minimum: 1, maximum: 500, default: 100 },
    offset: { type: "integer", minimum: 0, default: 0 },
  },
  additionalProperties: false,
} as const;

export const createJobBodySchema = {
  type: "object",
  required: ["uploadId"],
  properties: {
    uploadId: { type: "string", minLength: 1 },
    renderMode: { type: "string", enum: ["CPU", "GPU"] },
    computeMode: { type: "string", enum: ["CPU", "NVIDIA_CUDA", "NVIDIA_OPTIX"] },
  },
  additionalProperties: false,
} as const;

export const jobResponseSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    originalFilename: { type: "string" },
    projectPath: { type: "string" },
    blendFilePath: { type: ["string", "null"] },
    status: { type: "string" },
    progress: { type: "number" },
    currentFrame: { type: "integer" },
    totalFrames: { type: "integer" },
    renderEngine: { type: "string" },
    computeMode: { type: ["string", "null"] },
    renderMode: { type: "string" },
    createdAt: { type: "string" },
    startedAt: { type: ["string", "null"] },
    completedAt: { type: ["string", "null"] },
    errorMessage: { type: ["string", "null"] },
    createdBy: { type: ["string", "null"] },
    queuePosition: { type: ["integer", "null"] },
    workerId: { type: ["string", "null"] },
    outputs: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          jobId: { type: "string" },
          type: { type: "string" },
          filename: { type: "string" },
          path: { type: "string" },
          mimeType: { type: "string" },
          size: { type: "integer" },
          createdAt: { type: "string" },
        },
      },
    },
  },
} as const;
