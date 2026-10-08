// Copyright (c) 2026 TDK Landscape contributors
// SPDX-License-Identifier: MIT
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensureGitignore } from "../file-helpers.js";

describe("ensureGitignore", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "tdk-gitignore-"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("creates .gitignore with .env and generated output", () => {
    expect(ensureGitignore(dir)).toEqual([
      ".env",
      ".tdk/.tdk-out/",
      ".tdk/.project-id",
      ".tdk/smoke/",
      "node_modules/",
    ]);
    expect(readFileSync(join(dir, ".gitignore"), "utf-8")).toContain(".env\n");
  });

  it("appends only what's missing and keeps existing lines", () => {
    writeFileSync(join(dir, ".gitignore"), "node_modules\ndist");
    expect(ensureGitignore(dir)).toEqual([
      ".env",
      ".tdk/.tdk-out/",
      ".tdk/.project-id",
      ".tdk/smoke/",
    ]);
    const content = readFileSync(join(dir, ".gitignore"), "utf-8");
    expect(content.startsWith("node_modules\ndist\n")).toBe(true);
  });

  it("is a no-op the second time", () => {
    ensureGitignore(dir);
    expect(ensureGitignore(dir)).toEqual([]);
  });
});
