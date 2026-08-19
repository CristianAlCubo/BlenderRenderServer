import { spawn, type ChildProcess } from "node:child_process";

export interface RunCommandOptions {
  command: string;
  args: string[];
  cwd?: string;
  onStdout?: (line: string) => void;
  onStderr?: (line: string) => void;
  signal?: AbortSignal;
  env?: NodeJS.ProcessEnv;
}

export interface RunResult {
  code: number;
  killed: boolean;
}

export function runCommand(options: RunCommandOptions): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child: ChildProcess = spawn(options.command, options.args, {
      cwd: options.cwd,
      env: options.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let buffer = "";
    let errBuffer = "";

    const onAbort = () => {
      child.kill("SIGTERM");
      setTimeout(() => {
        if (!child.killed) child.kill("SIGKILL");
      }, 5000);
    };

    if (options.signal) {
      if (options.signal.aborted) onAbort();
      else options.signal.addEventListener("abort", onAbort, { once: true });
    }

    child.stdout?.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      if (options.onStdout) {
        buffer += text;
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) options.onStdout(line.replace(/\r$/, ""));
      }
    });

    child.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      if (options.onStderr) {
        errBuffer += text;
        const lines = errBuffer.split("\n");
        errBuffer = lines.pop() ?? "";
        for (const line of lines) options.onStderr(line.replace(/\r$/, ""));
      }
    });

    child.on("error", (err) => {
      options.signal?.removeEventListener("abort", onAbort);
      reject(err);
    });

    child.on("close", (code) => {
      options.signal?.removeEventListener("abort", onAbort);
      if (buffer.trim()) options.onStdout?.(buffer);
      if (errBuffer.trim()) options.onStderr?.(errBuffer);
      resolve({
        code: code ?? -1,
        killed: options.signal?.aborted ?? false,
      });
    });
  });
}
