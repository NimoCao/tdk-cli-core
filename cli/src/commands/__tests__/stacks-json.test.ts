// Copyright (c) 2026 TDK Landscape contributors
// SPDX-License-Identifier: MIT
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const cliBin = path.join(repoRoot, "cli", "bin", "tdk.js");

describe("tdk resources and stacks --json", () => {
  let projectRoots: string[] = [];

  afterEach(() => {
    for (const projectRoot of projectRoots) {
      fs.rmSync(projectRoot, { recursive: true, force: true });
    }
    projectRoots = [];
  });

  function createProject(includeResources = true): string {
    const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "tdk-list-json-"));
    projectRoots.push(projectRoot);
    fs.mkdirSync(path.join(projectRoot, ".tdk"), { recursive: true });
    fs.writeFileSync(path.join(projectRoot, ".tdk", "project.json"), "{}\n");

    if (includeResources) {
      const gatewayDir = path.join(projectRoot, "services", "api", "gateway");
      fs.mkdirSync(gatewayDir, { recursive: true });
      fs.writeFileSync(
        path.join(gatewayDir, "service.json"),
        JSON.stringify({ appName: "gateway", appType: "backend", stack: "api", port: 3100 }),
      );

      const workerDir = path.join(projectRoot, "services", "worker", "queue");
      fs.mkdirSync(workerDir, { recursive: true });
      fs.writeFileSync(
        path.join(workerDir, "service.json"),
        JSON.stringify({ appName: "queue", appType: "worker" }),
      );
    }

    return projectRoot;
  }

  function runTdk(args: string[], includeResources = true) {
    return spawnSync(process.execPath, [cliBin, ...args], {
      cwd: createProject(includeResources),
      encoding: "utf-8",
      env: { ...process.env, NO_COLOR: "1" },
    });
  }

  function parseSingleJsonLine(stdout: string) {
    const lines = stdout.trim().split(/\r?\n/);
    expect(lines).toHaveLength(1);
    return JSON.parse(lines[0]);
  }

  it("prints stack names and counts in a versioned JSON report", () => {
    const result = runTdk(["stacks", "--json"]);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(parseSingleJsonLine(result.stdout)).toMatchObject({
      schemaVersion: 1,
      data: { stacks: [{ name: "api", resourceCount: 1 }] },
      errors: [],
    });
    expect(result.stdout).not.toContain(String.fromCharCode(27));
  });

  it("prints an empty stack list as JSON instead of a human empty state", () => {
    const result = runTdk(["stacks", "--json"], false);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(parseSingleJsonLine(result.stdout)).toMatchObject({
      schemaVersion: 1,
      data: { stacks: [] },
      errors: [],
    });
  });

  it("includes service names when --services is combined with --json", () => {
    const result = runTdk(["stacks", "--services", "--json"]);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(parseSingleJsonLine(result.stdout)).toMatchObject({
      data: {
        stacks: [
          {
            name: "api",
            resourceCount: 1,
            services: ["gateway"],
          },
        ],
      },
    });
    const stack = parseSingleJsonLine(result.stdout).data.stacks[0];
    expect(stack.services).toHaveLength(stack.resourceCount);
    expect(stack).not.toHaveProperty("description");
  });

  it("fails with a machine error outside a project", () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "tdk-no-project-"));
    projectRoots.push(cwd);
    const result = spawnSync(process.execPath, [cliBin, "stacks", "--json"], {
      cwd,
      encoding: "utf-8",
      env: { ...process.env, NO_COLOR: "1" },
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Could not find project root");
    const envelope = parseSingleJsonLine(result.stdout);
    expect(envelope.data).toBeNull();
    expect(envelope.errors).toHaveLength(1);
  });

  it("includes descriptions when --verbose is combined with --json", () => {
    const result = runTdk(["stacks", "--verbose", "--json"]);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    const stack = parseSingleJsonLine(result.stdout).data.stacks[0];
    expect(stack.description).toBeTruthy();
    expect(stack).not.toHaveProperty("services");
  });

  it("filters the human resource list with --no-stack", () => {
    const result = runTdk(["resources", "--no-stack"]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("queue");
    expect(result.stdout).not.toContain("gateway");
    expect(result.stdout).not.toContain("not assigned to any stack");
  });

  it("keeps resource stack filters working with --json", () => {
    const assigned = runTdk(["resources", "--stack", "api", "--json"]);
    expect(assigned.status).toBe(0);
    expect(assigned.stderr).toBe("");
    expect(
      parseSingleJsonLine(assigned.stdout).data.resources.map(
        (item: { name: string }) => item.name,
      ),
    ).toEqual(["gateway"]);

    const unassigned = runTdk(["resources", "--no-stack", "--json"]);
    expect(unassigned.status).toBe(0);
    expect(unassigned.stderr).toBe("");
    expect(
      parseSingleJsonLine(unassigned.stdout).data.resources.map(
        (item: { name: string }) => item.name,
      ),
    ).toEqual(["queue"]);
  });
});
