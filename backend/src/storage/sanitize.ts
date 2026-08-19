import { basename } from "node:path";

const UNSAFE_RE = /[^a-zA-Z0-9._-]/g;

export function sanitizeFilename(filename: string): string {
  const base = basename(filename.replace(/\\/g, "/"));
  const cleaned = base.replace(UNSAFE_RE, "_").replace(/^\.+/, "").trim();
  const fallback = cleaned || "file";
  return fallback.length > 255 ? fallback.slice(0, 255) : fallback;
}

export function isAllowedUploadFilename(filename: string): boolean {
  const ext = filename.toLowerCase().split(".").pop();
  return ext === "blend" || ext === "zip";
}

export function sanitizeZipEntryPath(entryPath: string): string | null {
  let p = entryPath.replace(/\\/g, "/");

  if (p.startsWith("/") || /^[a-zA-Z]:/.test(p)) return null;

  const parts = p.split("/");
  const safe: string[] = [];
  for (const part of parts) {
    if (part === "" || part === ".") continue;
    if (part === "..") return null;
    safe.push(part);
  }
  if (safe.length === 0) return null;
  return safe.join("/");
}
