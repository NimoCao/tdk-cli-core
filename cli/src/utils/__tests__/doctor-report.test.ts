// Copyright (c) 2026 TDK Landscape contributors
// SPDX-License-Identifier: MIT
import { describe, expect, it } from "vitest";
import { collectDoctorChecks, createDoctorReport, getDoctorExitCode } from "../doctor-report.js";

const passing = { name: "Docker", didPass: true, message: "Ready" };

describe("doctor report contract", () => {
  it("returns readiness with warnings and skipped checks, preserving findings", () => {
    const checks = [
      passing,
      { name: "WSL path", didPass: false, isWarning: true, message: "Move from /mnt/c" },
      { name: "Health", didPass: false, isSkipped: true, message: "Not running" },
    ];
    const report = createDoctorReport(checks, true);
    expect(report).toEqual({
      schemaVersion: 1,
      data: { ready: true, inProject: true, checks },
      errors: [],
    });
    expect(getDoctorExitCode(report)).toBe(0);
  });

  it("returns 1 for blocking findings including strict-mode warnings", () => {
    const report = createDoctorReport([{ ...passing, didPass: false, fix: "Start Docker" }], false);
    expect(report.data.ready).toBe(false);
    expect(getDoctorExitCode(report)).toBe(1);
  });

  it("includes requested, chosen, explicit and reason fields for each planned port", () => {
    const plan = {
      ingressHttp: 8080,
      ingressHttps: 8443,
      postgres: 15432,
      requested: { ingressHttp: 80, ingressHttps: 443, postgres: 5432 },
      explicit: { ingressHttp: false, ingressHttps: true, postgres: false },
      reason: {
        ingressHttp: "selected from fallback range 8080-8180",
        ingressHttps: "explicit override",
        postgres: "selected from fallback range 15432-15532",
      },
    };
    const report = createDoctorReport([passing], true, [], plan);
    expect(report.data.ports).toEqual({
      http: {
        requested: 80,
        chosen: 8080,
        explicit: false,
        reason: "selected from fallback range 8080-8180",
      },
      https: { requested: 443, chosen: 8443, explicit: true, reason: "explicit override" },
      postgres: {
        requested: 5432,
        chosen: 15432,
        explicit: false,
        reason: "selected from fallback range 15432-15532",
      },
    });
  });

  it("returns 2 for usage and internal errors even if other checks pass", () => {
    for (const code of ["USAGE", "INTERNAL"] as const) {
      const report = createDoctorReport([passing], false, [{ code, message: "Failed" }]);
      expect(report.data.ready).toBe(false);
      expect(getDoctorExitCode(report)).toBe(2);
    }
  });

  it("settles all concurrent checks and preserves results when a probe throws", async () => {
    let cleanedUp = false;
    const result = await collectDoctorChecks(
      [
        () => {
          throw new Error("probe failure");
        },
        async () => {
          await Promise.resolve();
          cleanedUp = true;
          return passing;
        },
      ],
      [() => ({ ...passing, name: "Project" })],
    );
    expect(cleanedUp).toBe(true);
    expect(result.checks.map((check) => check.name)).toEqual(["Docker", "Project"]);
    expect(result.errors).toEqual([{ code: "INTERNAL", message: "probe failure" }]);
    expect(getDoctorExitCode(createDoctorReport(result.checks, true, result.errors))).toBe(2);
  });
});
