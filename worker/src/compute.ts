import { spawn } from "node:child_process";

import type { RenderCapabilities } from "@render-server/shared";

export interface ComputeInfo {
  computeModes: Array<"CPU" | "NVIDIA_CUDA" | "NVIDIA_OPTIX">;
  blenderVersion: string | null;
}

function run(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "ignore"] });
    let out = "";
    child.stdout.on("data", (d) => (out += d.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(out.trim());
      else reject(new Error(`${command} exited ${code}`));
    });
  });
}

export async function detectCompute(
  blenderPath: string,
): Promise<ComputeInfo> {
  const computeModes: Array<"CPU" | "NVIDIA_CUDA" | "NVIDIA_OPTIX"> = ["CPU"];

  let hasNvidia = false;
  try {
    const gpus = await run("nvidia-smi", ["--query-gpu=name", "--format=csv,noheader"]);
    hasNvidia = gpus.length > 0;
  } catch {
    hasNvidia = false;
  }

  if (hasNvidia) {
    computeModes.push("NVIDIA_CUDA");
    // OptiX is available when the driver exposes libnvoptix (denoiser/OptiX runtime)
    try {
      await run("bash", ["-c", "ldconfig -p | grep -q libnvoptix"]);
      computeModes.push("NVIDIA_OPTIX");
    } catch {
      // OptiX not detected
    }
  }

  let blenderVersion: string | null = null;
  try {
    const version = await run(blenderPath, ["--version"]);
    const m = version.match(/Blender\s+([\d.]+)/);
    blenderVersion = m ? m[1] : version.split("\n")[0];
  } catch {
    blenderVersion = null;
  }

  return { computeModes, blenderVersion };
}

export function capabilitiesToInfo(compute: ComputeInfo): RenderCapabilities {
  return {
    engine: "blender",
    computeModes: compute.computeModes,
    blenderVersion: compute.blenderVersion,
  };
}
