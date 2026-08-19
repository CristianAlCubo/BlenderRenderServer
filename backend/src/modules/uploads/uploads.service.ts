import { randomUUID } from "node:crypto";
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, copyFileSync } from "node:fs";
import { rm } from "node:fs/promises";
import { basename, join } from "node:path";

import type { MultipartFile } from "@fastify/multipart";
import { pipeline } from "node:stream/promises";

import type { AppConfig } from "../../config/index.js";
import type { StoragePaths } from "../../storage/paths.js";
import { extractZipSafe } from "../../storage/zip.js";
import { isAllowedUploadFilename, sanitizeFilename } from "../../storage/sanitize.js";

export interface UploadMeta {
  uploadId: string;
  originalFilename: string;
  storedPath: string;
  extension: string;
}

export interface PreparedProject {
  originalFilename: string;
  projectPath: string;
  blendFilePath: string;
}

export class UploadsService {
  constructor(
    private config: AppConfig,
    private storage: StoragePaths,
  ) {}

  private uploadsRoot(): string {
    return join(this.config.dataDir, "uploads");
  }

  private uploadDir(uploadId: string): string {
    return join(this.uploadsRoot(), uploadId);
  }

  private metaPath(uploadId: string): string {
    return join(this.uploadDir(uploadId), "meta.json");
  }

  async saveUpload(file: MultipartFile): Promise<UploadMeta> {
    const uploadId = randomUUID();
    const dir = this.uploadDir(uploadId);
    mkdirSync(dir, { recursive: true });

    const originalFilename = sanitizeFilename(file.filename || "upload");
    if (!isAllowedUploadFilename(originalFilename)) {
      await rm(dir, { recursive: true, force: true });
      throw new UploadError("unsupported_type", 400);
    }

    const extension = originalFilename.toLowerCase().split(".").pop()!;
    const storedPath = join(dir, `upload.${extension}`);

    try {
      await pipeline(file.file, createWriteStream(storedPath));
    } catch (err) {
      await rm(dir, { recursive: true, force: true });
      throw new UploadError("upload_failed", 400);
    }

    const meta: UploadMeta = { uploadId, originalFilename, storedPath, extension };
    writeFileSync(this.metaPath(uploadId), JSON.stringify(meta));
    return meta;
  }

  async getUpload(uploadId: string): Promise<UploadMeta | null> {
    const metaPath = this.metaPath(uploadId);
    if (!existsSync(metaPath)) return null;
    try {
      return JSON.parse(readFileSync(metaPath, "utf8")) as UploadMeta;
    } catch {
      return null;
    }
  }

  async prepare(uploadId: string): Promise<PreparedProject> {
    const meta = await this.getUpload(uploadId);
    if (!meta) throw new UploadError("upload_not_found", 404);
    if (!existsSync(meta.storedPath)) throw new UploadError("upload_file_missing", 400);

    const projectDir = this.storage.projectDir(uploadId);
    const assetsDir = this.storage.projectAssetsDir(uploadId);

    if (meta.extension === "zip") {
      const result = await extractZipSafe(meta.storedPath, assetsDir);
      const blendFile = result.blendFile;
      if (!blendFile) {
        throw new UploadError("no_blend_file_in_archive", 400);
      }
      return {
        originalFilename: meta.originalFilename,
        projectPath: projectDir,
        blendFilePath: blendFile,
      };
    }

    // .blend: copy into project dir
    const blendDest = join(projectDir, meta.originalFilename);
    copyFileSync(meta.storedPath, blendDest);
    return {
      originalFilename: meta.originalFilename,
      projectPath: projectDir,
      blendFilePath: blendDest,
    };
  }

  async cleanupUpload(uploadId: string): Promise<void> {
    await rm(this.uploadDir(uploadId), { recursive: true, force: true }).catch(() => {});
  }
}

export class UploadError extends Error {
  constructor(
    public code: string,
    public statusCode: number,
  ) {
    super(code);
  }
}
