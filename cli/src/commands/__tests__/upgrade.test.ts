// Copyright (c) 2026 TDK Landscape contributors
// SPDX-License-Identifier: MIT
import { createHash } from "node:crypto";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const execSyncMock = vi.fn();
const execFileSyncMock = vi.fn();
vi.mock("node:child_process", () => ({
  execSync: (...args: unknown[]) => execSyncMock(...args),
  execFileSync: (...args: unknown[]) => execFileSyncMock(...args),
}));
vi.mock("../../utils/tar.js", () => ({
  extractTarball: (_data: Buffer, destination: string) => {
    mkdirSync(destination, { recursive: true });
    writeFileSync(join(destination, "engine-marker"), "extracted");
  },
}));

const {
  classifyRunningInstall,
  isWritable,
  parseChecksums,
  upgradeViaBinary,
  upgradeViaNpm,
  upgradeViaBun,
  windowsNpmUpgradeMessage,
} = await import("../upgrade.js");

import type { BinaryRelease } from "../upgrade.js";

// Regression coverage for: `tdk upgrade` used to only swap the `tdk` binary
// and leave the bundled tdk-cli/ engine+templates folder next to it stale or
// missing, so an upgraded binary still crashed with the loadTemplate ENOENT
// (the exact error this was meant to fix). It must refresh both, every time.
const BINARY_BYTES = "fake tdk binary";
const ENGINE_BYTES = "fake engine tarball";
const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");

describe("upgradeViaBinary", () => {
  let installDir: string;
  let tdkPath: string;
  let release: BinaryRelease;
  let checksums: string;
  const fetchMock = vi.fn();

  beforeEach(() => {
    installDir = mkdtempSync(join(tmpdir(), "tdk-upgrade-test-"));
    tdkPath = join(installDir, "tdk");
    release = {
      tag: "v1.3.21",
      assetName: "tdk-darwin-arm64",
      downloadUrl: "https://example.test/tdk-darwin-arm64",
      engineDownloadUrl: "https://example.test/tdk-cli-engine.tar.gz",
      checksumsUrl: "https://example.test/checksums.txt",
    };
    checksums = [
      `${sha256(BINARY_BYTES)}  tdk-darwin-arm64`,
      `${sha256("other platform")}  tdk-linux-amd64`,
      `${sha256(ENGINE_BYTES)}  tdk-cli-engine.tar.gz`,
    ].join("\n");
    execSyncMock.mockReset();
    fetchMock.mockReset();
    fetchMock.mockImplementation(async (url: string) => ({
      ok: true,
      status: 200,
      arrayBuffer: async () =>
        Buffer.from(url === release.engineDownloadUrl ? ENGINE_BYTES : BINARY_BYTES),
      text: async () => checksums,
    }));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    rmSync(installDir, { recursive: true, force: true });
    vi.unstubAllGlobals();
  });

  it("downloads and extracts the bundled engine tarball next to the binary, not just the binary itself", async () => {
    const ok = await upgradeViaBinary(tdkPath, release);
    expect(ok).toBe(true);

    const engineDir = join(installDir, "tdk-cli");
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      release.downloadUrl,
      release.engineDownloadUrl,
      release.checksumsUrl,
    ]);
    expect(readFileSync(tdkPath, "utf-8")).toBe(BINARY_BYTES);
    expect(readFileSync(join(engineDir, "engine-marker"), "utf-8")).toBe("extracted");
  });

  it.skipIf(process.platform === "win32")(
    "installs the binary with the executable bit set",
    async () => {
      const ok = await upgradeViaBinary(tdkPath, release);
      expect(ok).toBe(true);
      expect(statSync(tdkPath).mode & 0o111).toBe(0o111);
    },
  );

  it("downloads both the binary and the engine tarball before installing either", async () => {
    await upgradeViaBinary(tdkPath, release);

    expect(fetchMock).toHaveBeenNthCalledWith(1, release.downloadUrl, expect.any(Object));
    expect(fetchMock).toHaveBeenNthCalledWith(2, release.engineDownloadUrl, expect.any(Object));
    expect(readFileSync(tdkPath, "utf-8")).toBe(BINARY_BYTES);
  });

  it("verifies checksums after both downloads and before installing anything", async () => {
    await upgradeViaBinary(tdkPath, release);

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      release.downloadUrl,
      release.engineDownloadUrl,
      release.checksumsUrl,
    ]);
    expect(existsSync(tdkPath)).toBe(true);
  });

  it.each([
    [
      "the binary does not match",
      () => checksums.replace(sha256(BINARY_BYTES), sha256("tampered")),
    ],
    [
      "the engine tarball does not match",
      () => checksums.replace(sha256(ENGINE_BYTES), sha256("x")),
    ],
    ["checksums.txt has no entry for the binary", () => checksums.replace("tdk-darwin-arm64", "x")],
  ])("refuses to install when %s", async (_case, makeChecksums) => {
    checksums = makeChecksums();
    const ok = await upgradeViaBinary(tdkPath, release);

    expect(ok).toBe(false);
    expect(existsSync(tdkPath)).toBe(false);
  });

  it("still installs releases whose checksums.txt predates the engine entry", async () => {
    checksums = checksums
      .split("\n")
      .filter((line) => !line.endsWith("tdk-cli-engine.tar.gz"))
      .join("\n");
    const ok = await upgradeViaBinary(tdkPath, release);

    expect(ok).toBe(true);
    expect(existsSync(tdkPath)).toBe(true);
  });

  // root ignores the write-permission bit (accessSync(W_OK) legitimately
  // returns true even on a 0o555 dir), so these checks only hold for
  // non-root users.
  const isRoot = process.getuid?.() === 0;

  it.skipIf(isRoot)(
    "never shells out to sudo, and fails fast without touching the network when the install dir isn't writable",
    async () => {
      chmodSync(installDir, 0o555);
      try {
        const ok = await upgradeViaBinary(tdkPath, release);
        expect(ok).toBe(false);
        expect(fetchMock).not.toHaveBeenCalled();
      } finally {
        chmodSync(installDir, 0o755);
      }
    },
  );

  it.skipIf(isRoot)("isWritable reflects actual filesystem permissions", () => {
    expect(isWritable(installDir)).toBe(true);
    chmodSync(installDir, 0o555);
    try {
      expect(isWritable(installDir)).toBe(false);
    } finally {
      chmodSync(installDir, 0o755);
    }
  });
});

describe("package-manager upgrade failures", () => {
  it("does not switch to the GitHub default branch when npm install fails", async () => {
    execSyncMock.mockReset();
    const npmStderr = "npm error code EACCES: permission denied\n";
    execSyncMock.mockImplementationOnce(() => {
      const error = new Error("Command failed: npm install -g @tdk-landscape/tdk-cli-core@latest");
      Object.assign(error, { stderr: Buffer.from(npmStderr) });
      throw error;
    });
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);

    try {
      const ok = await upgradeViaNpm();
      expect(ok).toBe(false);
      expect(execSyncMock).toHaveBeenCalledTimes(1);
      expect(String(execSyncMock.mock.calls[0]?.[0])).toBe(
        "npm install -g @tdk-landscape/tdk-cli-core@latest",
      );
      expect(execSyncMock.mock.calls[0]?.[1]).toMatchObject({
        stdio: ["inherit", "inherit", "pipe"],
      });
      expect(stderr).toHaveBeenCalledWith(npmStderr);
      const output = log.mock.calls.flat().map(String).join("\n");
      expect(output).toContain("npm install -g @tdk-landscape/tdk-cli-core@latest");
      expect(output).toContain("docs.npmjs.com");
      expect(output).not.toContain("github:");
      expect(output).not.toContain("Upgraded successfully");
    } finally {
      stderr.mockRestore();
      log.mockRestore();
    }
  });

  it("does not switch to the GitHub default branch when Bun install fails", async () => {
    execFileSyncMock.mockReset();
    execFileSyncMock.mockImplementationOnce(() => {
      throw new Error("registry unavailable");
    });
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      const ok = await upgradeViaBun();
      expect(ok).toBe(false);
      expect(execFileSyncMock).toHaveBeenCalledTimes(1);
      expect(execFileSyncMock.mock.calls[0]?.[1]).toEqual([
        "install",
        "-g",
        "@tdk-landscape/tdk-cli-core@latest",
      ]);
      const output = log.mock.calls.flat().map(String).join("\n");
      expect(output).toContain("bun install -g @tdk-landscape/tdk-cli-core@latest");
      expect(output).not.toContain("github:");
      expect(output).not.toContain("Upgraded successfully");
    } finally {
      log.mockRestore();
    }
  });
});

describe("parseChecksums", () => {
  it("reads both text-mode and binary-mode (*name) shasum lines and ignores junk", () => {
    const a = "a".repeat(64);
    const b = "B".repeat(64);
    const sums = parseChecksums(
      `${a}  tdk-linux-amd64\n${b} *tdk-cli-engine.tar.gz\n\nnot a checksum line\n`,
    );

    expect(sums.get("tdk-linux-amd64")).toBe(a);
    expect(sums.get("tdk-cli-engine.tar.gz")).toBe("b".repeat(64));
    expect(sums.size).toBe(2);
  });
});

describe("Windows upgrade installation routing", () => {
  it("recognizes a compiled Windows CLI executable", () => {
    expect(classifyRunningInstall("C:\\Users\\dev\\tdk.exe", "", "win32")).toEqual({
      method: "binary",
      path: "C:\\Users\\dev\\tdk.exe",
    });
  });

  it("recognizes an npm-installed Node entry point", () => {
    expect(
      classifyRunningInstall(
        "C:\\Program Files\\nodejs\\node.exe",
        "C:\\Users\\dev\\node_modules\\@tdk-landscape\\tdk-cli-core\\bin\\tdk.js",
        "win32",
      ),
    ).toEqual({
      method: "npm",
      path: "C:\\Users\\dev\\node_modules\\@tdk-landscape\\tdk-cli-core\\bin\\tdk.js",
    });
  });

  it("prints the npm update command instead of replacing npm files with an exe", () => {
    expect(windowsNpmUpgradeMessage("win32", { method: "npm" })).toBe(
      "use npm install -g @tdk-landscape/tdk-cli-core@latest",
    );
  });
});
