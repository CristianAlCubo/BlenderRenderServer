export interface RenderJobData {
  jobId: string;
  originalFilename: string;
  projectPath: string;
  blendFilePath: string;
  renderMode: "CPU" | "GPU";
  computeMode: string | null;
  outputType: "IMAGE" | "VIDEO";
  renderEngine: string;
}

export interface RenderResult {
  jobId: string;
  outputType: "IMAGE" | "VIDEO";
  frameCount: number;
  outputPaths: string[];
}

export interface RenderCapabilities {
  engine: string;
  computeModes: Array<"CPU" | "NVIDIA_CUDA" | "NVIDIA_OPTIX">;
  blenderVersion: string | null;
}

export interface RenderEngine {
  render(job: RenderJobData, options: RenderOptions): Promise<RenderResult>;
  cancel(jobId: string): Promise<void>;
  getCapabilities(): Promise<RenderCapabilities>;
}

export interface RenderOptions {
  blenderPath: string;
  ffmpegPath: string;
  framesDir: string;
  renderDir: string;
  logFilePath: string;
  computeMode: string | null;
  onProgress: (info: { currentFrame: number; totalFrames: number; progress: number }) => void;
  onLog: (level: string, message: string) => void;
  onEncoding?: () => void;
  signal?: AbortSignal;
}