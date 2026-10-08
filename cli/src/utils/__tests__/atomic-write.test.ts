// Copyright (c) 2026 TDK Landscape contributors
// SPDX-License-Identifier: MIT
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { writeTextFileAtomic } from "../atomic-write.js";

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "tdk-atomic-"));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("writeTextFileAtomic", () => {
  it("creates a new file", () => {
    const target = join(dir, "Tiltfile");
    writeTextFileAtomic(target, "new\n");
    expect(readFileSync(target, "utf-8")).toBe("new\n");
  });

  it("replaces an existing file and leaves no temp file behind", () => {
    const target = join(dir, "Tiltfile");
    writeFileSync(target, "old\n");
    writeTextFileAtomic(target, "new\n");
    expect(readFileSync(target, "utf-8")).toBe("new\n");
    expect(readdirSync(dir)).toEqual(["Tiltfile"]);
  });

  it("keeps the mode of the file it replaces", () => {
    const target = join(dir, "run.sh");
    writeFileSync(target, "old\n");
    chmodSync(target, 0o755);
    writeTextFileAtomic(target, "new\n");
    expect(statSync(target).mode & 0o777).toBe(0o755);
  });

  it("writes content larger than one pipe buffer in full", () => {
    const target = join(dir, "big.yml");
    const content = `${"x".repeat(200_000)}\n`;
    writeTextFileAtomic(target, content);
    expect(readFileSync(target, "utf-8")).toBe(content);
  });

  it("leaves the target untouched and removes its temp file when the replace fails", () => {
    const target = join(dir, "blocked");
    mkdirSync(target);
    writeFileSync(join(target, "keep.txt"), "keep\n");
    expect(() => writeTextFileAtomic(target, "new\n")).toThrow();
    expect(readFileSync(join(target, "keep.txt"), "utf-8")).toBe("keep\n");
    expect(readdirSync(dir)).toEqual(["blocked"]);
  });

  it("fails without creating anything when the directory does not exist", () => {
    expect(() => writeTextFileAtomic(join(dir, "missing", "f"), "x")).toThrow();
    expect(readdirSync(dir)).toEqual([]);
  });
});
