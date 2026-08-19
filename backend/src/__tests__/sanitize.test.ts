import { describe, expect, it } from "vitest";

import {
  isAllowedUploadFilename,
  sanitizeFilename,
  sanitizeZipEntryPath,
} from "../storage/sanitize.js";

describe("sanitizeFilename", () => {
  it("keeps safe names unchanged", () => {
    expect(sanitizeFilename("scene.blend")).toBe("scene.blend");
    expect(sanitizeFilename("my-project_v2.zip")).toBe("my-project_v2.zip");
  });

  it("strips path separators and directory components", () => {
    expect(sanitizeFilename("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFilename("C:\\Users\\evil.blend")).toBe("evil.blend");
    expect(sanitizeFilename("/absolute/path/scene.blend")).toBe("scene.blend");
  });

  it("replaces unsafe characters", () => {
    expect(sanitizeFilename("my scene (1).blend")).toBe("my_scene__1_.blend");
  });

  it("falls back when the name is empty after cleaning", () => {
    expect(sanitizeFilename("...")).toBe("file");
  });
});

describe("isAllowedUploadFilename", () => {
  it("accepts .blend and .zip", () => {
    expect(isAllowedUploadFilename("scene.blend")).toBe(true);
    expect(isAllowedUploadFilename("project.ZIP")).toBe(true);
  });

  it("rejects other extensions", () => {
    expect(isAllowedUploadFilename("malware.exe")).toBe(false);
    expect(isAllowedUploadFilename("notes.txt")).toBe(false);
    expect(isAllowedUploadFilename("no-extension")).toBe(false);
  });
});

describe("sanitizeZipEntryPath", () => {
  it("accepts normal relative paths", () => {
    expect(sanitizeZipEntryPath("scene.blend")).toBe("scene.blend");
    expect(sanitizeZipEntryPath("textures/wood.png")).toBe("textures/wood.png");
  });

  it("normalizes backslashes", () => {
    expect(sanitizeZipEntryPath("textures\\wood.png")).toBe("textures/wood.png");
  });

  it("rejects path traversal", () => {
    expect(sanitizeZipEntryPath("../evil.txt")).toBeNull();
    expect(sanitizeZipEntryPath("a/../../evil.txt")).toBeNull();
  });

  it("rejects absolute paths", () => {
    expect(sanitizeZipEntryPath("/etc/passwd")).toBeNull();
    expect(sanitizeZipEntryPath("C:/Windows/evil.exe")).toBeNull();
  });

  it("rejects empty path components", () => {
    expect(sanitizeZipEntryPath("")).toBeNull();
    expect(sanitizeZipEntryPath("./")).toBeNull();
  });
});
