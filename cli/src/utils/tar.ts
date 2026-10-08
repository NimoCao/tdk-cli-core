// Copyright (c) 2026 TDK Landscape contributors
// SPDX-License-Identifier: MIT
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Extracts a gzipped tarball (as an in-memory buffer) into destDir.
 * Shells out to the system `tar` binary rather than pulling in a JS tar
 * implementation - available by default on macOS and Linux.
 */
export function extractTarball(data: Buffer, destDir: string): void {
  const tempDir = mkdtempSync(join(tmpdir(), "tdk-ext-"));
  const tmpFile = join(tempDir, "bundle.tar.gz");
  writeFileSync(tmpFile, data);
  mkdirSync(destDir, { recursive: true });

  const tarBin = process.platform === "win32" ? "tar.exe" : "tar";
  const result = spawnSync(tarBin, ["xzf", tmpFile, "-C", destDir, "--strip-components=1"], {
    stdio: "pipe",
    windowsHide: true,
  });
  if (result.status !== 0) {
    const fallbackDir = join(tempDir, "fallback");
    mkdirSync(fallbackDir, { recursive: true });
    const fallback = spawnSync(tarBin, ["xzf", tmpFile, "-C", fallbackDir], {
      stdio: "pipe",
      windowsHide: true,
    });
    if (fallback.status !== 0) {
      rmSync(tempDir, { recursive: true, force: true });
      throw new Error(
        `tar extraction failed: ${fallback.stderr?.toString() || result.stderr?.toString() || "unknown error"}`,
      );
    }
    const entries = readdirSync(fallbackDir);
    const sourceDir =
      entries.length === 1 &&
      existsSync(join(fallbackDir, entries[0])) &&
      statSync(join(fallbackDir, entries[0])).isDirectory()
        ? join(fallbackDir, entries[0])
        : fallbackDir;
    for (const entry of readdirSync(sourceDir)) {
      renameSync(join(sourceDir, entry), join(destDir, entry));
    }
  }
  rmSync(tempDir, { recursive: true, force: true });
}
