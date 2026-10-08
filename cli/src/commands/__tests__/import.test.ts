// Copyright (c) 2026 TDK Landscape contributors
// SPDX-License-Identifier: MIT
import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { IMPORT_PACKAGE, importCommand, importInvocation, runImport } from "../import.js";

function fakeSpawn(outcome: { code?: number | null; error?: Error }) {
  const calls: unknown[][] = [];
  const spawnFn = ((command: string, args: string[], options: unknown) => {
    calls.push([command, args, options]);
    const child = new EventEmitter();
    queueMicrotask(() =>
      outcome.error ? child.emit("error", outcome.error) : child.emit("close", outcome.code),
    );
    return child;
  }) as never;
  return { calls, spawnFn };
}

describe("tdk import", () => {
  it("forwards every argument, including flags, to tdk-import", () => {
    const inv = importInvocation([".", "--dry-run", "--only", "procfile"], {}, "linux");
    expect(inv).toEqual({
      command: "npx",
      args: ["--yes", IMPORT_PACKAGE, ".", "--dry-run", "--only", "procfile"],
      shell: false,
    });
  });

  it("honours TDK_IMPORT_PACKAGE and uses npx.cmd on Windows", () => {
    const inv = importInvocation(["."], { TDK_IMPORT_PACKAGE: "tdk-import@1" }, "win32");
    expect(inv.command).toBe("npx.cmd");
    expect(inv.args).toEqual(["--yes", "tdk-import@1", "."]);
    expect(inv.shell).toBe(true);
  });

  it("passes the child's exit code through and inherits stdio", async () => {
    const { calls, spawnFn } = fakeSpawn({ code: 3 });
    expect(await runImport(["x"], spawnFn)).toBe(3);
    expect((calls[0]?.[2] as { stdio: string } | undefined)?.stdio).toBe("inherit");
  });

  it("reports a missing npx with exit 127", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const { spawnFn } = fakeSpawn({ error: new Error("ENOENT") });
    expect(await runImport([], spawnFn)).toBe(127);
    expect(err).toHaveBeenCalledWith(expect.stringContaining("could not run npx"));
    err.mockRestore();
  });

  it("is registered as `import` and leaves --help to tdk-import", () => {
    expect(importCommand.name()).toBe("import");
    expect(importCommand.helpCommand).toBeDefined();
    expect(importCommand.options.find((o) => o.long === "--help")).toBeUndefined();
  });
});
