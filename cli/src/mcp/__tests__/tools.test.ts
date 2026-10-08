// Copyright (c) 2026 TDK Landscape contributors
// SPDX-License-Identifier: MIT
import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import {
  buildLogsArgs,
  buildUpArgs,
  cliInvocation,
  createTdkTools,
  startUp,
  toToolResult,
  type UpDeps,
} from "../tools.js";

describe("argument building", () => {
  it("builds up arguments, one --only= per service so a value is never a flag", () => {
    expect(buildUpArgs({ stack: "store", only: ["api", "web"], force: true })).toEqual([
      "up",
      "store",
      "--only=api",
      "--only=web",
      "--force",
      "--json",
    ]);
    expect(buildUpArgs({})).toEqual(["up", "--json"]);
  });
  it.each([
    [{ stack: "-rf" }],
    [{ only: ["ok", "--json"] }],
    [{ only: "api" }],
    [{ force: "yes" }],
    [{ stack: "a b" }],
  ])("rejects %j", (args) => {
    expect(() => buildUpArgs(args)).toThrow();
  });
  it("builds and validates logs arguments", () => {
    expect(buildLogsArgs({ services: ["api"], tail: 50, since: "5m" })).toEqual([
      "logs",
      "--json",
      "--service=api",
      "--tail=50",
      "--since=5m",
    ]);
    for (const bad of [{ tail: 0 }, { tail: 1.5 }, { since: "5" }, { services: ["-x"] }]) {
      expect(() => buildLogsArgs(bad)).toThrow();
    }
  });
});

describe("cliInvocation", () => {
  it("re-runs a script with its interpreter", () => {
    expect(cliInvocation("/usr/bin/node", "/opt/tdk/bin/tdk.js", () => true)).toEqual([
      "/usr/bin/node",
      "/opt/tdk/bin/tdk.js",
    ]);
  });
  it("runs a compiled binary alone, because its argv[1] is a virtual path", () => {
    expect(cliInvocation("/usr/local/bin/tdk", "/$bunfs/root/tdk", () => false)).toEqual([
      "/usr/local/bin/tdk",
    ]);
    expect(cliInvocation("C:\\tdk.exe", "B:\\~BUN\\root\\tdk.exe", () => false)).toEqual([
      "C:\\tdk.exe",
    ]);
  });
  it("falls back to the executable when there is no script", () => {
    expect(cliInvocation("/usr/local/bin/tdk", "")).toEqual(["/usr/local/bin/tdk"]);
  });
});

describe("toToolResult", () => {
  const run = (stdout: string, exitCode = 0) => ({ exitCode, stdout, stderr: "boom" });
  it("passes a clean envelope through as a success", () => {
    const r = toToolResult(run('{"schemaVersion":1,"data":{"ready":false},"errors":[]}\n', 1));
    expect(r.isError).toBe(false);
  });
  it("marks an envelope with errors or ok:false as an error", () => {
    expect(
      toToolResult(run('{"schemaVersion":1,"data":null,"errors":[{"code":"X","message":"m"}]}'))
        .isError,
    ).toBe(true);
    expect(toToolResult(run('{"schemaVersion":1,"data":{"ok":false},"errors":[]}')).isError).toBe(
      true,
    );
  });
  it("uses the last JSON line and reports missing JSON with stderr", () => {
    expect(toToolResult(run('noise\n{"schemaVersion":1,"data":{"a":1},"errors":[]}')).isError).toBe(
      false,
    );
    const none = toToolResult(run("", 2));
    expect(none.isError).toBe(true);
    expect(JSON.stringify(none.data)).toContain("boom");
  });
});

function fakeUp(options: { logs: string[]; exitAfter?: { atRead: number; code: number } }): {
  deps: UpDeps;
  child: EventEmitter & { pid: number; unref: () => void };
} {
  const child = Object.assign(new EventEmitter(), { pid: 4242, unref: vi.fn() });
  let reads = 0;
  let clock = 0;
  const deps: UpDeps = {
    spawnUp: () => child as never,
    readLog: () => {
      const text = options.logs[Math.min(reads, options.logs.length - 1)] ?? "";
      reads += 1;
      if (options.exitAfter && reads === options.exitAfter.atRead)
        child.emit("exit", options.exitAfter.code);
      return text;
    },
    sleep: async () => {
      clock += 1000;
    },
    now: () => clock,
    logFile: () => "/tmp/x.log",
  };
  return { deps, child };
}

describe("startUp", () => {
  it("returns an early refusal from the child", async () => {
    const line =
      '{"schemaVersion":1,"data":{"ok":false},"errors":[{"code":"UNKNOWN_SERVICE","message":"nope"}]}';
    const { deps } = fakeUp({ logs: ["", line] });
    const r = await startUp({ only: ["nope"] }, deps);
    expect(r.isError).toBe(true);
    expect(JSON.stringify(r.data)).toContain("UNKNOWN_SERVICE");
  });
  it("returns started + a polling hint, and detaches, when nothing happens within the window", async () => {
    const { deps, child } = fakeUp({ logs: [""] });
    const r = await startUp({ waitSeconds: 3 }, deps);
    expect(r.isError).toBe(false);
    expect(r.data).toMatchObject({ data: { started: true, pid: 4242, logFile: "/tmp/x.log" } });
    expect(child.unref).toHaveBeenCalled();
  });
  it("reports a child that exits without a result, with the log tail", async () => {
    const { deps } = fakeUp({ logs: ["", "Error: it broke"], exitAfter: { atRead: 2, code: 1 } });
    const r = await startUp({}, deps);
    expect(r.isError).toBe(true);
    expect(JSON.stringify(r.data)).toContain("it broke");
  });
  it("returns a ready result immediately when the child already printed one", async () => {
    const line = '{"schemaVersion":1,"data":{"ok":true,"services":["api"]},"errors":[]}';
    const { deps } = fakeUp({ logs: [line] });
    expect((await startUp({}, deps)).isError).toBe(false);
  });
});

describe("tool list", () => {
  it("exposes the six tools with object schemas and no streaming logs", () => {
    const tools = createTdkTools(async () => ({ exitCode: 0, stdout: "", stderr: "" }));
    expect(tools.map((t) => t.name)).toEqual([
      "doctor",
      "up",
      "down",
      "status",
      "logs",
      "resource_list",
    ]);
    for (const t of tools)
      expect(t.inputSchema).toMatchObject({ type: "object", additionalProperties: false });
    expect(JSON.stringify(tools.find((t) => t.name === "logs")?.inputSchema)).not.toContain(
      "follow",
    );
  });
  it("routes a tool to its command", async () => {
    const seen: string[][] = [];
    const tools = createTdkTools(async (args) => {
      seen.push(args);
      return { exitCode: 0, stdout: '{"schemaVersion":1,"data":[],"errors":[]}', stderr: "" };
    });
    await tools.find((t) => t.name === "resource_list")?.handler({ stack: "store" });
    await tools.find((t) => t.name === "status")?.handler({});
    expect(seen).toEqual([
      ["resources", "--json", "--stack=store"],
      ["status", "--json"],
    ]);
  });
});
