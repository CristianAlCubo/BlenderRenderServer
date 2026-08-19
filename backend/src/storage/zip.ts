import { createWriteStream, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { pipeline } from "node:stream/promises";

import yauzl from "yauzl";

import { sanitizeZipEntryPath } from "./sanitize.js";

const S_IFLNK = 0xa000;
const MAX_ENTRIES = 20000;
const MAX_UNCOMPRESSED_SIZE = 20 * 1024 ** 3;

export type ZipExtractionResult = {
  extractedFiles: string[];
  blendFile: string | null;
};

function openZip(filePath: string): Promise<yauzl.ZipFile> {
  return new Promise((resolve, reject) => {
    yauzl.open(filePath, { lazyEntries: true, autoClose: true }, (err, zipfile) => {
      if (err) reject(err);
      else resolve(zipfile!);
    });
  });
}

export async function extractZipSafe(
  zipPath: string,
  destination: string,
): Promise<ZipExtractionResult> {
  const zipfile = await openZip(zipPath);

  const extractedFiles: string[] = [];
  let blendFile: string | null = null;
  let entryCount = 0;
  let totalSize = 0;

  return new Promise<ZipExtractionResult>((resolve, reject) => {
    zipfile.on("entry", (entry: yauzl.Entry) => {
      entryCount += 1;
      if (entryCount > MAX_ENTRIES) {
        reject(new Error("Archive contains too many entries"));
        return;
      }
      totalSize += entry.uncompressedSize;
      if (totalSize > MAX_UNCOMPRESSED_SIZE) {
        reject(new Error("Archive is too large when decompressed"));
        return;
      }

      const isSymlink =
        ((entry.externalFileAttributes >>> 16) & S_IFLNK) === S_IFLNK;

      if (isSymlink) {
        reject(new Error(`Archive contains a symlink: ${entry.fileName}`));
        return;
      }

      const safeRel = sanitizeZipEntryPath(entry.fileName);
      if (safeRel === null) {
        reject(new Error(`Unsafe path in archive: ${entry.fileName}`));
        return;
      }

      const outPath = join(destination, safeRel);

      if (entry.fileName.endsWith("/")) {
        mkdirSync(outPath, { recursive: true });
        zipfile.readEntry();
        return;
      }

      mkdirSync(dirname(outPath), { recursive: true });

      zipfile.openReadStream(entry, (err, readStream) => {
        if (err) {
          reject(err);
          return;
        }
        pipeline(readStream!, createWriteStream(outPath))
          .then(() => {
            extractedFiles.push(outPath);
            if (/\.blend$/i.test(entry.fileName) && !blendFile) {
              blendFile = outPath;
            }
            zipfile.readEntry();
          })
          .catch(reject);
      });
    });

    zipfile.on("end", () => {
      resolve({ extractedFiles, blendFile });
    });

    zipfile.on("error", reject);
    zipfile.readEntry();
  });
}

export async function findBlendFile(
  files: string[],
  projectDir: string,
): Promise<string | null> {
  const blend = files.find((f) => /\.blend$/i.test(f));
  if (blend) return blend;
  return null;
}
