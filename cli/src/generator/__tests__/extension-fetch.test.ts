// Copyright (c) 2026 TDK Landscape contributors
// SPDX-License-Identifier: MIT
// Covers the exact three scenarios demonstrated manually on the real CLI:
//   1. no TDK_LICENSE_KEY set          -> free tier, zero network calls
//   2. TDK_LICENSE_KEY set but invalid -> "no premium resources unlocked", free tier
//   3. TDK_LICENSE_KEY set and valid   -> premium files applied over the stubs
//
// Only the network boundary (fetch) is mocked - tar extraction, the file
// overlay, and the on-disk cache all run for real against temp directories,
// so this exercises the same code path `tdk project` actually runs.

import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let projectRoot: string;
let destDir: string;
let fakeHome: string;
let fixtureTarball: Buffer;

function buildFixtureTarball(): Buffer {
  const src = mkdtempSync(join(tmpdir(), "tdk-premium-fixture-"));
  mkdirSync(join(src, "typescript"), { recursive: true });
  writeFileSync(
    join(src, "typescript", "playwright_config.star"),
    "# REAL premium playwright config\ndef generate_playwright_config(): pass\n",
  );
  writeFileSync(join(src, "c4_diagram.star"), "# REAL premium c4 diagram generator\n");

  // Match exactly how the real premium.tar.gz is built (tar -C dir .), so
  // entries get a "./" prefix - extractTarball's --strip-components=1
  // expects that dummy leading component, not a real directory name.
  const tarPath = join(src, "..", "premium-fixture.tar.gz");
  execFileSync("tar", ["-czf", tarPath, "-C", src, "."]);
  const buf = readFileSync(tarPath);
  rmSync(src, { recursive: true, force: true });
  rmSync(tarPath, { force: true });
  return buf;
}

beforeEach(() => {
  projectRoot = mkdtempSync(join(tmpdir(), "tdk-project-"));
  destDir = mkdtempSync(join(tmpdir(), "tdk-dest-"));
  fakeHome = mkdtempSync(join(tmpdir(), "tdk-home-"));

  // Seed destDir with the free-tier stub, same as vendorTdkExtension does
  // before ever calling applyPremiumOverlay - so we can assert it gets
  // overwritten only when a premium fetch actually succeeds.
  mkdirSync(join(destDir, "engine/topologies/tilt/generators/typescript"), { recursive: true });
  writeFileSync(
    join(destDir, "engine/topologies/tilt/generators/typescript/playwright_config.star"),
    "# unlicensed stub\n",
  );

  process.env.HOME = fakeHome;
  delete process.env.TDK_LICENSE_KEY;
  delete process.env.TDK_PREMIUM_ENDPOINT;
  vi.restoreAllMocks();
});

afterEach(() => {
  rmSync(projectRoot, { recursive: true, force: true });
  rmSync(destDir, { recursive: true, force: true });
  rmSync(fakeHome, { recursive: true, force: true });
  vi.unstubAllGlobals();
});

describe("applyPremiumOverlay", () => {
  it("scenario 1: no license key -> returns false, never calls fetch", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const { applyPremiumOverlay } = await import("../extension-fetch.js");
    const applied = await applyPremiumOverlay(projectRoot, destDir);

    expect(applied).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
    // Stub must be left untouched - zero side effects for free users.
    expect(
      readFileSync(
        join(destDir, "engine/topologies/tilt/generators/typescript/playwright_config.star"),
        "utf-8",
      ),
    ).toBe("# unlicensed stub\n");
  });

  it("scenario 2: invalid/ungranted key -> tries every known resource, then falls back to free tier", async () => {
    process.env.TDK_LICENSE_KEY = "tdk-fa411b"; // the mistyped key from the real session

    const fetchSpy = vi
      .fn()
      .mockResolvedValue(new Response("key does not grant resource", { status: 403 }));
    vi.stubGlobal("fetch", fetchSpy);

    const { applyPremiumOverlay } = await import("../extension-fetch.js");
    const applied = await applyPremiumOverlay(projectRoot, destDir);

    expect(applied).toBe(false);
    // Every known resource name gets a shot before giving up.
    expect(fetchSpy).toHaveBeenCalledTimes(6);
    // The key goes in the Authorization header, never the URL (a 403 from a
    // current worker means it read the key, so there's no ?key= retry).
    for (const [url, init] of fetchSpy.mock.calls as [string, RequestInit][]) {
      expect(url).not.toContain("key=");
      expect(url).not.toContain("tdk-fa411b");
      expect(init.headers).toEqual({ Authorization: "Bearer tdk-fa411b" });
    }
    expect(
      readFileSync(
        join(destDir, "engine/topologies/tilt/generators/typescript/playwright_config.star"),
        "utf-8",
      ),
    ).toBe("# unlicensed stub\n");
  });

  it("scenario 3: valid key granting the first resource -> real files overlay the stubs", async () => {
    process.env.TDK_LICENSE_KEY = "tdk-fa411a"; // the real key from the session, grants playwright
    fixtureTarball ??= buildFixtureTarball();

    const fetchSpy = vi.fn().mockImplementation((url: string) => {
      if (url.includes("resource=playwright")) {
        return Promise.resolve(new Response(new Uint8Array(fixtureTarball), { status: 200 }));
      }
      return Promise.resolve(new Response("not granted", { status: 403 }));
    });
    vi.stubGlobal("fetch", fetchSpy);

    const { applyPremiumOverlay } = await import("../extension-fetch.js");
    const applied = await applyPremiumOverlay(projectRoot, destDir);

    expect(applied).toBe(true);
    // Stops at the first granted resource - doesn't keep trying c4-diagram/logging.
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const playwrightOut = readFileSync(
      join(destDir, "engine/topologies/tilt/generators/typescript/playwright_config.star"),
      "utf-8",
    );
    expect(playwrightOut).toContain("REAL premium playwright config");
    expect(playwrightOut).not.toContain("unlicensed stub");

    const c4Out = readFileSync(
      join(destDir, "engine/topologies/tilt/generators/c4_diagram.star"),
      "utf-8",
    );
    expect(c4Out).toContain("REAL premium c4 diagram generator");
  });

  it("sends the per-project id and reuses it across calls instead of generating a new one each time", async () => {
    process.env.TDK_LICENSE_KEY = "tdk-fa411b";
    const seenProjectIds: string[] = [];
    const fetchSpy = vi.fn().mockImplementation((url: string) => {
      seenProjectIds.push(new URL(url).searchParams.get("projectId") ?? "");
      return Promise.resolve(new Response("not granted", { status: 403 }));
    });
    vi.stubGlobal("fetch", fetchSpy);

    const { applyPremiumOverlay } = await import("../extension-fetch.js");
    await applyPremiumOverlay(projectRoot, destDir);
    const idFile = join(projectRoot, ".tdk", ".project-id");
    expect(existsSync(idFile)).toBe(true);
    const persistedId = readFileSync(idFile, "utf-8").trim();

    expect(new Set(seenProjectIds).size).toBe(1);
    expect(seenProjectIds[0]).toBe(persistedId);
  });

  it("caches a successful fetch and does not re-fetch within the TTL", async () => {
    process.env.TDK_LICENSE_KEY = "tdk-fa411a";
    fixtureTarball ??= buildFixtureTarball();

    const fetchSpy = vi
      .fn()
      .mockResolvedValue(new Response(new Uint8Array(fixtureTarball), { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);

    const { applyPremiumOverlay } = await import("../extension-fetch.js");
    await applyPremiumOverlay(projectRoot, destDir);
    await applyPremiumOverlay(projectRoot, destDir);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("re-fetches once the cached bundle is older than the TTL", async () => {
    process.env.TDK_LICENSE_KEY = "tdk-fa411a";
    fixtureTarball ??= buildFixtureTarball();

    // A Response body can only be read once - mockResolvedValue would
    // reuse the same instance across both calls in this test, so build a
    // fresh Response per invocation instead.
    const fetchSpy = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(new Response(new Uint8Array(fixtureTarball), { status: 200 })),
      );
    vi.stubGlobal("fetch", fetchSpy);

    const { applyPremiumOverlay } = await import("../extension-fetch.js");
    await applyPremiumOverlay(projectRoot, destDir);

    const cachedPath = join(fakeHome, ".tdk", "cache", "premium-tdk-fa411a", "premium.tar.gz");
    expect(existsSync(cachedPath)).toBe(true);
    const longAgo = new Date(Date.now() - 13 * 60 * 60 * 1000); // TTL is 12h
    utimesSync(cachedPath, longAgo, longAgo);

    await applyPremiumOverlay(projectRoot, destDir);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("switching keys uses a separate cache instead of serving the other key's bundle", async () => {
    fixtureTarball ??= buildFixtureTarball();

    process.env.TDK_LICENSE_KEY = "tdk-fa411a";
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(new Uint8Array(fixtureTarball), { status: 200 })),
    );
    const { applyPremiumOverlay } = await import("../extension-fetch.js");
    await applyPremiumOverlay(projectRoot, destDir);

    process.env.TDK_LICENSE_KEY = "tdk-fa411b";
    const secondFetch = vi.fn().mockResolvedValue(new Response("not granted", { status: 403 }));
    vi.stubGlobal("fetch", secondFetch);
    const applied = await applyPremiumOverlay(projectRoot, destDir);

    expect(applied).toBe(false);
    expect(secondFetch).toHaveBeenCalled();
  });

  it("a network error is caught, never throws, and falls back to the free tier", async () => {
    process.env.TDK_LICENSE_KEY = "tdk-fa411a";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network unreachable")));

    const { applyPremiumOverlay } = await import("../extension-fetch.js");
    await expect(applyPremiumOverlay(projectRoot, destDir)).resolves.toBe(false);
  });
});

describe("license key transport", () => {
  it("retries once with ?key= when a worker that predates the header answers 401", async () => {
    process.env.TDK_LICENSE_KEY = "tdk-fa411a";
    fixtureTarball ??= buildFixtureTarball();
    // An old worker only reads ?key=: header-only requests look keyless (401).
    const fetchSpy = vi
      .fn()
      .mockImplementation((url: string) =>
        Promise.resolve(
          url.includes("key=tdk-fa411a")
            ? new Response(new Uint8Array(fixtureTarball), { status: 200 })
            : new Response("missing key", { status: 401 }),
        ),
      );
    vi.stubGlobal("fetch", fetchSpy);

    const { applyPremiumOverlay } = await import("../extension-fetch.js");
    const applied = await applyPremiumOverlay(projectRoot, destDir);

    expect(applied).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    const [first, second] = fetchSpy.mock.calls as [string, RequestInit | undefined][];
    expect(first[0]).not.toContain("key=");
    expect(first[1]?.headers).toEqual({ Authorization: "Bearer tdk-fa411a" });
    expect(second[0]).toContain("key=tdk-fa411a");
  });

  it("license checks (hasDddLicense) send the key in the header too", async () => {
    process.env.TDK_LICENSE_KEY = "tdk-fa411a";
    const fetchSpy = vi.fn().mockResolvedValue(new Response("ok", { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);

    const { hasDddLicense } = await import("../extension-fetch.js");

    expect(await hasDddLicense(projectRoot)).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("resource=ddd");
    expect(url).not.toContain("key=");
    expect(init.headers).toEqual({ Authorization: "Bearer tdk-fa411a" });
  });
});
