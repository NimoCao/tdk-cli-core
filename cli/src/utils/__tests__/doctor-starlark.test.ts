// Copyright (c) 2026 TDK Landscape contributors
// SPDX-License-Identifier: MIT
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  collectReachableStarlarkFiles,
  findMissingRelativeStarlarkLoads,
  findPrivateStarlarkLoadExports,
  findRelativeStarlarkLoadTargets,
  resolveStarlarkLoadTarget,
} from "../doctor-starlark.js";

describe("Starlark doctor helpers", () => {
  let projectRoot: string;

  beforeEach(() => {
    projectRoot = mkdtempSync(join(tmpdir(), "tdk-doctor-starlark-"));
  });

  afterEach(() => {
    rmSync(projectRoot, { recursive: true, force: true });
  });

  function writeProjectFile(relativePath: string, content: string): string {
    const file = join(projectRoot, relativePath);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
    return file;
  }

  it("finds private names exported by a relative load", () => {
    expect(
      findPrivateStarlarkLoadExports('load("./library.star", "_private", visible = "public")'),
    ).toEqual(["_private"]);
  });

  it("resolves relative paths and leaves external loads alone", () => {
    const entry = join(projectRoot, "Tiltfile");

    expect(resolveStarlarkLoadTarget(entry, "./library.star", projectRoot)).toBe(
      join(projectRoot, "library.star"),
    );
    expect(resolveStarlarkLoadTarget(entry, "ext://tdk-cli", projectRoot)).toBe(
      join(projectRoot, ".tdk", ".tdk-out", "tdk-cli-ext", "Tiltfile"),
    );
    expect(resolveStarlarkLoadTarget(entry, "@repo//:library.star", projectRoot)).toBeNull();
  });

  it("reports a missing relative load target", () => {
    const entry = writeProjectFile("Tiltfile", 'load("./missing.star", "value")');

    expect(
      findMissingRelativeStarlarkLoads(entry, readFileSync(entry, "utf-8"), projectRoot),
    ).toEqual([`${entry}: ./missing.star -> ${join(projectRoot, "missing.star")}`]);
  });

  it("finds reachable targets without repeating a cycle", () => {
    const entry = writeProjectFile("Tiltfile", 'load("./library.star", "value")');
    const library = writeProjectFile("library.star", 'load("./Tiltfile", "value")');

    expect(
      findRelativeStarlarkLoadTargets(entry, readFileSync(entry, "utf-8"), projectRoot),
    ).toEqual([library]);
    expect(collectReachableStarlarkFiles(entry, projectRoot)).toEqual([entry, library].sort());
  });

  it("keeps an entry file with no loads reachable", () => {
    const entry = writeProjectFile("Tiltfile", "# no loads");

    expect(
      findRelativeStarlarkLoadTargets(entry, readFileSync(entry, "utf-8"), projectRoot),
    ).toEqual([]);
    expect(collectReachableStarlarkFiles(entry, projectRoot)).toEqual([entry]);
  });
});
