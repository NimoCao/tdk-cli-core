// Copyright (c) 2026 TDK Landscape contributors
// SPDX-License-Identifier: MIT
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { TdkError } from "../../utils/errors.js";
import {
  FRONTEND_FRAMEWORKS,
  getFrontendFramework,
  listFrontendFrameworks,
  resolveFrontendFramework,
  VERIFIED_FRONTEND_FRAMEWORKS,
} from "../registry.js";

const SPA_IDS = [
  "react",
  "vue",
  "svelte",
  "preact",
  "lit",
  "solid",
  "qwik",
  "tanstack-router",
  "vanilla",
];

describe("frontend framework inventory", () => {
  it("lists exactly the registered vite-spa adapters", () => {
    const list = listFrontendFrameworks();
    expect(list.map((f) => f.id).sort()).toEqual([...SPA_IDS].sort());
    expect(list.every((f) => f.kind === "vite-spa")).toBe(true);
    for (const meta of ["next", "nuxt", "sveltekit", "astro", "angular"]) {
      expect(list.some((f) => f.id === meta)).toBe(false);
    }
  });

  it("marks only verified providers as verified", () => {
    expect(VERIFIED_FRONTEND_FRAMEWORKS.every((id) => id in FRONTEND_FRAMEWORKS)).toBe(true);
    expect(listFrontendFrameworks().every((f) => f.verified)).toBe(true);
  });

  it("keeps the verify script's default list in sync with the registry", () => {
    const script = readFileSync(
      resolve(__dirname, "../../../../scripts/verify-frontend-frameworks.sh"),
      "utf8",
    );
    const m = script.match(/frameworks=\(([^)]*)\)\nfi/);
    expect((m?.[1] ?? "").split(/\s+/).sort()).toEqual(Object.keys(FRONTEND_FRAMEWORKS).sort());
  });
});

describe("frontend framework resolution", () => {
  it("defaults to react", () => {
    expect(resolveFrontendFramework("frontend")?.id).toBe("react");
  });

  it("hands a meta-framework off to bring-your-own", () => {
    try {
      getFrontendFramework("next", "web");
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(TdkError);
      const err = e as TdkError;
      expect(err.message).toContain("react, vue");
      expect(JSON.stringify(err)).toContain("tdk resource web --type bring-your-own");
    }
  });

  it("fails closed on an unknown id without a handoff", () => {
    try {
      getFrontendFramework("not-a-framework", "web");
      expect.unreachable();
    } catch (e) {
      const err = e as TdkError;
      expect(err.message).toContain("react, vue");
      expect(JSON.stringify(err)).not.toContain("bring-your-own");
    }
  });
});
