// Copyright (c) 2026 TDK Landscape contributors
// SPDX-License-Identifier: MIT
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  databaseManagementEnabled,
  evaluateSharedPlatformPostgres,
  isSharedPlatformPostgresDependency,
  POSTGRES_DEPENDENCY_NAMES,
} from "../shared-platform-postgres.js";

let root: string;

function writeProjectJson(config: Record<string, unknown>): void {
  writeFileSync(join(root, ".tdk", "project.json"), JSON.stringify(config));
}

function featureOffProjectJson(): Record<string, unknown> {
  return {
    project: { name: "demo" },
    always_enabled_infra: ["proxy"],
    phases: {
      pre_alpha: { name: "Pre-Alpha", description: "", enabledStacks: ["app"] },
      alpha: { name: "Alpha", description: "", enabledStacks: [] },
      beta: { name: "Beta", description: "", enabledStacks: [] },
      out_of_scope: { name: "Out of Scope", description: "", enabledStacks: [] },
    },
  };
}

function featureOnProjectJson(): Record<string, unknown> {
  return {
    project: { name: "demo" },
    always_enabled_infra: ["database-management", "proxy"],
    phases: {
      pre_alpha: {
        name: "Pre-Alpha",
        description: "",
        enabledStacks: ["app", "database-management"],
      },
      alpha: { name: "Alpha", description: "", enabledStacks: [] },
      beta: { name: "Beta", description: "", enabledStacks: [] },
      out_of_scope: { name: "Out of Scope", description: "", enabledStacks: [] },
    },
  };
}

function resource(
  stack: string,
  name: string,
  config: Record<string, unknown>,
  files: Record<string, string> = { "package.json": "{}" },
): void {
  const dir = join(root, "services", stack, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "service.json"), JSON.stringify({ appName: name, stack, ...config }));
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(join(dir, file, ".."), { recursive: true });
    writeFileSync(join(dir, file), content);
  }
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "tdk-shared-platform-postgres-"));
  mkdirSync(join(root, ".tdk"), { recursive: true });
  writeProjectJson(featureOffProjectJson());
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("isSharedPlatformPostgresDependency", () => {
  it("accepts only the two shared names", () => {
    expect(POSTGRES_DEPENDENCY_NAMES).toEqual(["postgres", "database-management"]);
    expect(isSharedPlatformPostgresDependency("postgres")).toBe(true);
    expect(isSharedPlatformPostgresDependency("database-management")).toBe(true);
    expect(isSharedPlatformPostgresDependency("postgress")).toBe(false);
    expect(isSharedPlatformPostgresDependency("Postgres")).toBe(false);
    expect(isSharedPlatformPostgresDependency("postgresql")).toBe(false);
  });
});

describe("databaseManagementEnabled", () => {
  it("is true when always_enabled_infra is omitted — same default the generator bakes into the Tiltfile", () => {
    // template-engine: always_enabled_infra ?? DEFAULT_ALWAYS_ENABLED_INFRA
    // Tiltfile: ALWAYS_ENABLED_INFRA includes database-management →
    // should_enable returns RESOURCE_DEFAULTS.get(name, True) → feature ON.
    writeProjectJson({ project: { name: "demo" } });
    expect(databaseManagementEnabled(root)).toBe(true);
  });

  it("is true when phases.*.enabledStacks include database-management", () => {
    writeProjectJson({
      project: { name: "demo" },
      always_enabled_infra: ["proxy"],
      phases: {
        pre_alpha: { enabledStacks: ["database-management"] },
        alpha: { enabledStacks: [] },
        beta: { enabledStacks: [] },
        out_of_scope: { enabledStacks: [] },
      },
    });
    expect(databaseManagementEnabled(root)).toBe(true);
  });

  it("is true when always_enabled_infra explicitly includes database-management even without enabledStacks", () => {
    writeProjectJson({
      project: { name: "demo" },
      always_enabled_infra: ["database-management", "proxy"],
      phases: {
        pre_alpha: { enabledStacks: ["app"] },
        alpha: { enabledStacks: [] },
        beta: { enabledStacks: [] },
        out_of_scope: { enabledStacks: [] },
      },
    });
    expect(databaseManagementEnabled(root)).toBe(true);
  });

  it("is false when always_enabled_infra is present without database-management and no phase lists it", () => {
    // Explicit field (not omitted) → Tiltfile ALWAYS_ENABLED_INFRA omits dm →
    // Utils.should_enable defaults False when not in RESOURCE_DEFAULTS/cfg.
    writeProjectJson(featureOffProjectJson());
    expect(databaseManagementEnabled(root)).toBe(false);
  });

  it("shares DEFAULT_ALWAYS_ENABLED_INFRA with the project generator", async () => {
    const { DEFAULT_ALWAYS_ENABLED_INFRA } = await import("../project-config-defaults.js");
    expect([...DEFAULT_ALWAYS_ENABLED_INFRA]).toContain("database-management");
    expect([...DEFAULT_ALWAYS_ENABLED_INFRA]).toContain("proxy");
  });
});

describe("evaluateSharedPlatformPostgres", () => {
  it("willStart when feature on", () => {
    writeProjectJson(featureOnProjectJson());
    resource("app", "api", { appType: "backend", port: 4000 });
    const evaluation = evaluateSharedPlatformPostgres(root);
    expect(evaluation.featureOn).toBe(true);
    expect(evaluation.willStart).toBe(true);
    expect(evaluation.reason).toBe("feature");
  });

  it("willStart when a resource has dependsOn postgres and feature is off", () => {
    resource("app", "orders-api", {
      appType: "backend",
      port: 4000,
      dependsOn: ["postgres"],
    });
    const evaluation = evaluateSharedPlatformPostgres(root);
    expect(evaluation.featureOn).toBe(false);
    expect(evaluation.willStart).toBe(true);
    expect(evaluation.reason).toBe("dependsOn");
    expect(evaluation.dependsOnUsers).toEqual(["orders-api"]);
  });

  it("willStart when a resource has dependsOn database-management and feature is off", () => {
    resource("app", "billing-api", {
      appType: "backend",
      port: 4100,
      dependsOn: ["database-management"],
    });
    const evaluation = evaluateSharedPlatformPostgres(root);
    expect(evaluation.willStart).toBe(true);
    expect(evaluation.reason).toBe("dependsOn");
    expect(evaluation.dependsOnUsers).toEqual(["billing-api"]);
  });

  it("willStart false when feature is off and nothing depends on either name", () => {
    resource("app", "api", { appType: "backend", port: 4000, dependsOn: [] });
    const evaluation = evaluateSharedPlatformPostgres(root);
    expect(evaluation.willStart).toBe(false);
    expect(evaluation.reason).toBe("none");
    expect(evaluation.dependsOnUsers).toEqual([]);
  });

  it("reports unknown name postgress", () => {
    resource("app", "orders-api", {
      appType: "backend",
      port: 4000,
      dependsOn: ["postgress"],
    });
    const evaluation = evaluateSharedPlatformPostgres(root);
    expect(evaluation.unknownDependsOnNames).toEqual([
      { resource: "orders-api", name: "postgress" },
    ]);
    expect(evaluation.willStart).toBe(false);
  });

  it("reports other unknown names (Postgres, postgresql, my-db)", () => {
    resource("app", "orders-api", {
      appType: "backend",
      port: 4000,
      dependsOn: ["Postgres", "postgresql", "my-db"],
    });
    const evaluation = evaluateSharedPlatformPostgres(root);
    expect(evaluation.unknownDependsOnNames.map((e) => e.name)).toEqual([
      "Postgres",
      "postgresql",
      "my-db",
    ]);
  });

  it("prisma not in featuresEnabled does not affect willStart", () => {
    resource("app", "orders-api", {
      appType: "backend",
      port: 4000,
      dependsOn: ["postgres"],
      // prisma intentionally absent
    });
    const evaluation = evaluateSharedPlatformPostgres(root);
    expect(evaluation.willStart).toBe(true);
    expect(evaluation.reason).toBe("dependsOn");
  });

  it("finds dependsOn postgres via project-scoped discovery (not tdk up --only)", () => {
    // Resource lives under a stack a hypothetical `tdk up --only other` would not select.
    resource("other", "billing-api", {
      appType: "backend",
      port: 4100,
      dependsOn: ["postgres"],
    });
    const evaluation = evaluateSharedPlatformPostgres(root);
    expect(evaluation.willStart).toBe(true);
    expect(evaluation.dependsOnUsers).toEqual(["billing-api"]);
  });

  it("does not treat known sibling service names as unknown", () => {
    resource("app", "auth", { appType: "backend", port: 4200 });
    resource("app", "orders-api", {
      appType: "backend",
      port: 4000,
      dependsOn: ["auth", "postgres"],
    });
    const evaluation = evaluateSharedPlatformPostgres(root);
    expect(evaluation.unknownDependsOnNames).toEqual([]);
    expect(evaluation.willStart).toBe(true);
    expect(evaluation.dependsOnUsers).toEqual(["orders-api"]);
  });
});
