// Copyright (c) 2026 TDK Landscape contributors
// SPDX-License-Identifier: MIT
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const cliPath = path.join(repoRoot, "cli", "bin", "tdk.js");
const masterConfigFiles = ["TILT_TECH_STACK.star", "TILT_RESOURCE_DEFAULTS.star", "spec.master"];

function createProject(configured: boolean | string[]): string {
  const projectRoot = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "tdk-projects-json-")));
  fs.mkdirSync(path.join(projectRoot, ".tdk"), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, ".tdk", "project.json"), "{}\n");

  fs.mkdirSync(path.join(projectRoot, "services", "api"), { recursive: true });
  fs.writeFileSync(
    path.join(projectRoot, "services", "api", "service.json"),
    JSON.stringify({ appName: "api", runtime: "node", stack: "backend" }),
  );
  fs.mkdirSync(path.join(projectRoot, "services", "worker"), { recursive: true });
  fs.writeFileSync(
    path.join(projectRoot, "services", "worker", "service.json"),
    JSON.stringify({ appName: "worker", runtime: "node" }),
  );

  if (configured) {
    const outDir = path.join(projectRoot, ".tdk", ".tdk-out");
    fs.mkdirSync(outDir, { recursive: true });
    for (const file of configured === true ? masterConfigFiles : configured) {
      fs.writeFileSync(path.join(outDir, file), "");
    }
  }

  return projectRoot;
}

function runProjects(projectRoot: string, check: boolean) {
  return spawnSync(
    process.execPath,
    [cliPath, "projects", "--json", ...(check ? ["--check"] : [])],
    {
      cwd: projectRoot,
      encoding: "utf-8",
      env: { ...process.env, FORCE_COLOR: "1" },
    },
  );
}

function parseReport(result: ReturnType<typeof runProjects>) {
  expect(result.stderr).toBe("");
  expect(result.stdout).not.toContain("\u001b[");
  return JSON.parse(result.stdout);
}

describe("tdk projects --json", () => {
  it("prints the project report without --check and returns 1 for missing config with --check", () => {
    const projectRoot = createProject(false);
    try {
      const plain = runProjects(projectRoot, false);
      expect(plain.status).toBe(0);
      const report = parseReport(plain);
      expect(report).toMatchObject({
        schemaVersion: 1,
        data: {
          projectRoot,
          configured: false,
          missingFiles: masterConfigFiles,
          resources: 2,
          stacks: ["backend"],
          unassignedResources: 1,
        },
        errors: [],
      });

      const checked = runProjects(projectRoot, true);
      expect(checked.status).toBe(1);
      expect(parseReport(checked)).toEqual(report);
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it("returns 0 for a configured project with --check", () => {
    const projectRoot = createProject(true);
    try {
      const result = runProjects(projectRoot, true);
      expect(result.status).toBe(0);
      expect(parseReport(result)).toMatchObject({
        schemaVersion: 1,
        data: {
          projectRoot,
          configured: true,
          missingFiles: [],
          resources: 2,
          stacks: ["backend"],
          unassignedResources: 1,
        },
        errors: [],
      });
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it("lists only the missing master files when the project is partially configured", () => {
    const projectRoot = createProject(["TILT_TECH_STACK.star", "spec.master"]);
    try {
      const result = runProjects(projectRoot, true);
      expect(result.status).toBe(1);
      expect(parseReport(result)).toMatchObject({
        data: { configured: false, missingFiles: ["TILT_RESOURCE_DEFAULTS.star"] },
        errors: [],
      });
    } finally {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
  });

  it("reports a machine error with exit 1 when no project root exists", () => {
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), "tdk-projects-json-empty-"));
    try {
      for (const check of [false, true]) {
        const result = runProjects(emptyDir, check);
        expect(result.status).toBe(1);
        expect(result.stderr).toContain("Could not find project root");
        expect(result.stdout).not.toContain("\u001b[");
        const body = JSON.parse(result.stdout);
        expect(body.data).toBeNull();
        expect(body.errors[0].code).toBe("COMMAND_FAILED");
      }
    } finally {
      fs.rmSync(emptyDir, { recursive: true, force: true });
    }
  }, 30_000); // two CLI runs; the 5s default is exceeded under full-suite load
});
