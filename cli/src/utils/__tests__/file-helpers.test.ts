// Copyright (c) 2026 TDK Landscape contributors
// SPDX-License-Identifier: MIT
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  ensureDirectory,
  writeJsonFile,
  writeJsonFileInDir,
  writeTextFile,
  writeTextFileInDir,
} from "../file-helpers.js";

let root = "";

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "tdk-file-helpers-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("file helpers", () => {
  it("writes JSON with two-space indentation and a trailing newline by default", () => {
    const filePath = join(root, "default.json");

    writeJsonFile(filePath, { name: "api", enabled: true });

    expect(readFileSync(filePath, "utf-8")).toBe('{\n  "name": "api",\n  "enabled": true\n}\n');
  });

  it("respects a custom JSON indentation width", () => {
    const filePath = join(root, "custom.json");

    writeJsonFile(filePath, { name: "api" }, 4);

    expect(readFileSync(filePath, "utf-8")).toBe('{\n    "name": "api"\n}\n');
  });

  it("writes JSON and text files inside the supplied directory", () => {
    writeJsonFileInDir(root, "config.json", { name: "api" });
    writeTextFileInDir(root, "notes.txt", "created in the requested directory");

    expect(readFileSync(join(root, "config.json"), "utf-8")).toBe('{\n  "name": "api"\n}\n');
    expect(readFileSync(join(root, "notes.txt"), "utf-8")).toBe(
      "created in the requested directory",
    );
  });

  it("writes text content exactly", () => {
    const filePath = join(root, "content.txt");
    const content = "first line\nsecond line\n";

    writeTextFile(filePath, content);

    expect(readFileSync(filePath, "utf-8")).toBe(content);
  });

  it("creates nested directories and accepts an existing directory", () => {
    const nested = join(root, "one", "two", "three");

    ensureDirectory(nested);

    expect(existsSync(nested)).toBe(true);
    expect(() => ensureDirectory(nested)).not.toThrow();
  });
});
