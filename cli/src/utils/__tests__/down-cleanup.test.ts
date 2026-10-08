// Copyright (c) 2026 TDK Landscape contributors
// SPDX-License-Identifier: MIT
import { describe, expect, it, vi } from "vitest";
import {
  findProjectTiltUpPids,
  projectNetworkNames,
  pruneProjectNetworks,
  stopProjectTiltUp,
} from "../down-cleanup.js";

const TILTFILE = "/work/shop/.tdk/.tdk-out/Tiltfile";

describe("projectNetworkNames", () => {
  it("prefixes the engine's network names with the underscored project name", () => {
    const names = projectNetworkNames("my-shop");
    expect(names).toContain("my_shop_traefik-public");
    expect(names).toContain("my_shop_backend");
    expect(names).toContain("my_shop_infisical-network");
    expect(names).toHaveLength(7);
  });
});

describe("pruneProjectNetworks", () => {
  it("removes only this project's networks and reports those Docker refuses to remove", () => {
    const calls: string[][] = [];
    const runner = vi.fn((_cmd: string, args: string[]) => {
      calls.push(args);
      if (args[1] === "ls")
        return "bridge\nshop_backend\nshop_database\nother_backend\nshop_proxy\n";
      if (args[2] === "shop_database") {
        throw Object.assign(new Error("x"), {
          stderr: "Error response from daemon: network shop_database has active endpoints\n",
        });
      }
      return "";
    });
    const result = pruneProjectNetworks("shop", runner);
    expect(result.removed).toEqual(["shop_backend", "shop_proxy"]);
    expect(result.kept).toEqual([
      {
        name: "shop_database",
        reason: "Error response from daemon: network shop_database has active endpoints",
      },
    ]);
    const removed = calls.filter((a) => a[1] === "rm").map((a) => a[2]);
    expect(removed).not.toContain("other_backend");
    expect(removed).not.toContain("bridge");
  });
});

describe("findProjectTiltUpPids", () => {
  const ps = [
    `  100 /opt/homebrew/bin/tilt up -f ${TILTFILE} -- --focus=shop`,
    `  101 /opt/homebrew/bin/tilt up -f /work/other/.tdk/.tdk-out/Tiltfile`,
    `  102 /opt/homebrew/bin/tilt down -f ${TILTFILE}`,
    `  103 /opt/homebrew/bin/tilt up -f ${TILTFILE}-copy`,
    `  104 vim ${TILTFILE}`,
    `  105 tilt up -f ${TILTFILE}`,
  ].join("\n");

  it("matches only tilt up processes for this project's Tiltfile", () => {
    expect(findProjectTiltUpPids(TILTFILE, "darwin", () => ps)).toEqual([100, 105]);
  });

  it("returns nothing on Windows or when ps fails", () => {
    expect(findProjectTiltUpPids(TILTFILE, "win32", () => ps)).toEqual([]);
    expect(
      findProjectTiltUpPids(TILTFILE, "linux", () => {
        throw new Error("no ps");
      }),
    ).toEqual([]);
  });

  it("sends TERM to each match", () => {
    const sent: string[][] = [];
    const runner = (cmd: string, args: string[]) => {
      if (cmd === "ps") return ps;
      sent.push(args);
      return "";
    };
    expect(stopProjectTiltUp(TILTFILE, "darwin", runner)).toEqual([100, 105]);
    expect(sent).toEqual([
      ["-TERM", "100"],
      ["-TERM", "105"],
    ]);
  });
});

describe("waitForTiltUpExit", () => {
  it("resolves true once the processes are gone and false on timeout", async () => {
    const { waitForTiltUpExit } = await import("../down-cleanup.js");
    const seq = [[1], [1], []];
    expect(await waitForTiltUpExit(TILTFILE, 5000, () => seq.shift() ?? [])).toBe(true);
    expect(await waitForTiltUpExit(TILTFILE, 300, () => [1])).toBe(false);
  });
});
