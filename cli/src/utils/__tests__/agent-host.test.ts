// Copyright (c) 2026 TDK Landscape contributors
// SPDX-License-Identifier: MIT
import { describe, expect, it } from "vitest";
import { hostUpRefusal } from "../../commands/up.js";
import { detectHost, type HostProbeInputs } from "../agent-host.js";
import { createDoctorReport } from "../doctor-report.js";

const base: HostProbeInputs = {
  env: {},
  versions: process.versions,
  platform: "linux",
  fileExists: () => false,
};

describe("detectHost", () => {
  it("detects a WebContainer and refuses up", () => {
    const host = detectHost({
      ...base,
      versions: { ...process.versions, webcontainer: "1" } as never,
    });
    expect(host).toEqual({ kind: "webcontainer", canUp: false });
  });
  it("detects Codespaces before the generic Dev Container", () => {
    expect(
      detectHost({ ...base, env: { CODESPACES: "true", REMOTE_CONTAINERS: "true" } }).kind,
    ).toBe("codespaces");
  });
  it("detects a Dev Container via REMOTE_CONTAINERS", () => {
    expect(detectHost({ ...base, env: { REMOTE_CONTAINERS: "true" } }).kind).toBe("devcontainer");
  });
  it("does not treat a bare /.dockerenv as a Dev Container", () => {
    expect(detectHost({ ...base, fileExists: () => true }).kind).toBe("local");
  });
  it("reports native Windows as unable to up unless explicitly allowed", () => {
    expect(detectHost({ ...base, platform: "win32" })).toEqual({
      kind: "native-windows",
      canUp: false,
    });
    expect(
      detectHost({ ...base, platform: "win32", env: { TDK_ALLOW_NATIVE_WINDOWS: "1" } }).canUp,
    ).toBe(true);
  });
  it("detects WSL2 and plain local hosts", () => {
    expect(detectHost({ ...base, env: { WSL_DISTRO_NAME: "Ubuntu" } }).kind).toBe("wsl2");
    expect(detectHost(base).kind).toBe("local");
  });
});

describe("hostUpRefusal", () => {
  it("refuses a WebContainer without probing Docker", async () => {
    const probe = async () => {
      throw new Error("must not probe");
    };
    expect(await hostUpRefusal({ kind: "webcontainer", canUp: false }, probe)).toMatch(
      /WebContainers/,
    );
  });
  it("gives Dev Container remediation when Docker is unreachable", async () => {
    expect(await hostUpRefusal({ kind: "devcontainer", canUp: true }, async () => false)).toMatch(
      /Dev Container/,
    );
  });
  it("allows reachable Docker and never probes on a local host", async () => {
    expect(await hostUpRefusal({ kind: "devcontainer", canUp: true }, async () => true)).toBeNull();
    expect(await hostUpRefusal({ kind: "local", canUp: true }, async () => false)).toBeNull();
  });
});

describe("doctor report host", () => {
  it("sets canUp false when the container runtime check failed", () => {
    const report = createDoctorReport(
      [{ name: "Container Runtime", didPass: false, message: "down" }],
      false,
      [],
      undefined,
      { kind: "devcontainer", canUp: true },
    );
    expect(report.data.host).toEqual({
      kind: "devcontainer",
      canUp: false,
      containerRuntimeReachable: false,
    });
  });
});
