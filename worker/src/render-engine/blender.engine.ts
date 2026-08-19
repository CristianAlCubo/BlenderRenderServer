import { appendFileSync } from "node:fs";
import { basename, join } from "node:path";

import type {
  RenderCapabilities,
  RenderEngine,
  RenderJobData,
  RenderOptions,
  RenderResult,
} from "@render-server/shared";

import { detectCompute } from "../compute.js";
import { runCommand } from "../process.js";

interface SceneInfo {
  frameStart: number;
  frameEnd: number;
  fps: number;
  resolutionX: number;
  resolutionY: number;
}

export class BlenderRenderEngine implements RenderEngine {
  private activeSignals = new Map<string, AbortController>();

  async getCapabilities(): Promise<RenderCapabilities> {
    const info = await detectCompute(this.defaultBlenderPath);
    return {
      engine: "blender",
      computeModes: info.computeModes,
      blenderVersion: info.blenderVersion,
    };
  }

  constructor(private defaultBlenderPath = "/opt/blender/blender") {}

  async render(job: RenderJobData, options: RenderOptions): Promise<RenderResult> {
    const controller = new AbortController();
    this.activeSignals.set(job.jobId, controller);
    const signal = options.signal ?? controller.signal;

    const log = (level: string, message: string) => {
      options.onLog(level, message);
      try {
        appendFileSync(options.logFilePath, message + "\n");
      } catch {
        // ignore log write failures
      }
    };

    try {
      log("INFO", `Starting Blender render for job ${job.jobId}`);

      const blenderPath = options.blenderPath || this.defaultBlenderPath;
      const sceneInfo = await this.readSceneInfo(blenderPath, job.blendFilePath);

      const totalFrames = Math.max(1, sceneInfo.frameEnd - sceneInfo.frameStart + 1);
      const isVideo = totalFrames > 1;
      const outputType: "IMAGE" | "VIDEO" = isVideo ? "VIDEO" : "IMAGE";

      const framePattern = join(options.framesDir, "frame_");
      const args = this.buildRenderArgs({
        blenderPath,
        scene: job.blendFilePath,
        framePattern,
        computeMode: options.computeMode,
        animation: isVideo,
        frame: sceneInfo.frameStart,
      });

      log("INFO", `Blender command: ${[blenderPath, ...args.slice(1)].join(" ")}`);

      let completedFrames = 0;
      let currentFrame = 0;

      const result = await runCommand({
        command: blenderPath,
        args,
        cwd: options.renderDir,
        signal,
        onStdout: (line) => {
          log("INFO", line);
          const fra = line.match(/Fra:(\d+)/);
          if (fra) {
            currentFrame = Number(fra[1]);
          }
          const saved = line.match(/Saved:\s*['"].*frame_(\d+)\./);
          if (saved) {
            completedFrames += 1;
            currentFrame = Number(saved[1]);
            const progress = Math.min(100, Math.round((completedFrames / totalFrames) * 100));
            options.onProgress({
              currentFrame,
              totalFrames,
              progress,
            });
          }
        },
        onStderr: (line) => {
          log("WARN", line);
        },
      });

      if (result.killed || signal.aborted) {
        log("WARN", "Blender process was cancelled");
        throw new CancelError();
      }

      if (result.code !== 0) {
        log("ERROR", `Blender exited with code ${result.code}`);
        throw new Error(`Blender exited with code ${result.code}`);
      }

      const outputPaths: string[] = [];

      if (isVideo) {
        log("INFO", "Encoding frames to MP4 with FFmpeg");
        options.onLog("INFO", "Starting FFmpeg encoding");
        options.onEncoding?.();
        const outputMp4 = join(options.renderDir, "output.mp4");
        const encodeArgs = [
          "-y",
          "-framerate",
          String(sceneInfo.fps),
          "-i",
          join(options.framesDir, "frame_%04d.png"),
          "-c:v",
          "libx264",
          "-pix_fmt",
          "yuv420p",
          outputMp4,
        ];
        const encode = await runCommand({
          command: options.ffmpegPath,
          args: encodeArgs,
          cwd: options.renderDir,
          signal,
          onStdout: (line) => log("INFO", line),
          onStderr: (line) => log("INFO", line),
        });

        if (encode.killed || signal.aborted) throw new CancelError();
        if (encode.code !== 0) {
          log("ERROR", `FFmpeg exited with code ${encode.code}`);
          throw new Error(`FFmpeg exited with code ${encode.code}`);
        }
        outputPaths.push(outputMp4);
      } else {
        // single image frame
        const outputPng = join(options.framesDir, `frame_${String(sceneInfo.frameStart).padStart(4, "0")}.png`);
        outputPaths.push(outputPng);
      }

      log("INFO", `Render complete: ${outputType} (${totalFrames} frames)`);
      return {
        jobId: job.jobId,
        outputType,
        frameCount: totalFrames,
        outputPaths,
      };
    } finally {
      this.activeSignals.delete(job.jobId);
    }
  }

  async cancel(jobId: string): Promise<void> {
    const signal = this.activeSignals.get(jobId);
    if (signal) signal.abort();
  }

  private buildRenderArgs(input: {
    blenderPath: string;
    scene: string;
    framePattern: string;
    computeMode: string | null;
    animation: boolean;
    frame: number;
  }): string[] {
    const args = ["-b", input.scene];

    if (input.computeMode === "NVIDIA_OPTIX" || input.computeMode === "NVIDIA_CUDA") {
      const deviceType = input.computeMode === "NVIDIA_OPTIX" ? "OPTIX" : "CUDA";
      args.push(
        "--python-expr",
        `import bpy\ntry:\n c=bpy.context\n p=c.preferences.addons['cycles'].preferences\n c.scene.cycles.device='GPU'\n p.compute_device_type='${deviceType}'\n for d in p.devices: d.use=(d.type=='${deviceType}')\nexcept Exception:\n pass`,
      );
    }

    args.push("-o", input.framePattern, "-F", "PNG");

    if (input.animation) {
      args.push("-x", "1", "-a");
    } else {
      args.push("-f", String(input.frame));
    }

    return args;
  }

  private async readSceneInfo(blenderPath: string, scene: string): Promise<SceneInfo> {
    const expr =
      "import bpy; s=bpy.context.scene; print('SCENE_INFO', s.frame_start, s.frame_end, s.render.fps, s.render.resolution_x, s.render.resolution_y)";
    let captured = "";
    await runCommand({
      command: blenderPath,
      args: ["-b", scene, "--python-expr", expr],
      onStdout: (line) => {
        if (line.includes("SCENE_INFO")) captured = line;
      },
    });

    const m = captured.match(/SCENE_INFO\s+(\d+)\s+(\d+)\s+([\d.]+)\s+(\d+)\s+(\d+)/);
    if (m) {
      return {
        frameStart: Number(m[1]),
        frameEnd: Number(m[2]),
        fps: Number(m[3]),
        resolutionX: Number(m[4]),
        resolutionY: Number(m[5]),
      };
    }

    return { frameStart: 1, frameEnd: 1, fps: 30, resolutionX: 1920, resolutionY: 1080 };
  }
}

export class CancelError extends Error {
  constructor() {
    super("cancelled");
  }
}
