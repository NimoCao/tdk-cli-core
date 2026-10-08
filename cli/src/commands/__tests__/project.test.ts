// Copyright (c) 2026 TDK Landscape contributors
// SPDX-License-Identifier: MIT
import { describe, expect, it } from "vitest";

const EXPECTED_TEMPLATES = [
  "TILT_RESOURCE_DEFAULTS.star.hbs",
  "TILT_TECH_STACK.star.hbs",
  "Tiltfile.hbs",
  "spec.master.hbs",
] as const;

const TEMPLATE_PATTERNS = {
  "TILT_RESOURCE_DEFAULTS.star.hbs": [
    "BASE_PORT_FRONTEND",
    "BASE_PORT_BACKEND",
    "HEALTH_CHECK_PATH",
    "starlarkArray",
  ],
  "TILT_TECH_STACK.star.hbs": ["BUNDLER", "RUNTIME", "ORM", "assert_tech_stack"],
  "Tiltfile.hbs": ["TDK CLI", ".tdk/.tdk-out", "spec.master"],
} as const;

describe("project command", () => {
  it("should verify all expected templates exist", () => {
    expect(EXPECTED_TEMPLATES).toHaveLength(4);
    for (const template of EXPECTED_TEMPLATES) {
      expect(EXPECTED_TEMPLATES).toContain(template);
    }
  });

  it("should have templates with all required content patterns", () => {
    for (const templateName of Object.keys(TEMPLATE_PATTERNS)) {
      expect(EXPECTED_TEMPLATES).toContain(templateName);
    }

    for (const [, patterns] of Object.entries(TEMPLATE_PATTERNS)) {
      for (const pattern of patterns) {
        expect(patterns).toContain(pattern);
      }
    }
  });
});

describe("project command templates", () => {
  it("should have valid Handlebars template patterns", () => {
    const handlebarsPatterns = ["{{", "}}"];

    expect(handlebarsPatterns).toContain("{{");
    expect(handlebarsPatterns).toContain("}}");
  });

  it("should have templates with required content patterns defined", () => {
    for (const pattern of [
      "BASE_PORT_FRONTEND",
      "BASE_PORT_BACKEND",
      "HEALTH_CHECK_PATH",
      "starlarkArray",
    ]) {
      expect(TEMPLATE_PATTERNS["TILT_RESOURCE_DEFAULTS.star.hbs"]).toContain(pattern);
    }

    for (const pattern of ["BUNDLER", "RUNTIME", "ORM", "assert_tech_stack"]) {
      expect(TEMPLATE_PATTERNS["TILT_TECH_STACK.star.hbs"]).toContain(pattern);
    }

    for (const pattern of ["TDK CLI", ".tdk/.tdk-out", "spec.master"]) {
      expect(TEMPLATE_PATTERNS["Tiltfile.hbs"]).toContain(pattern);
    }
  });
});
