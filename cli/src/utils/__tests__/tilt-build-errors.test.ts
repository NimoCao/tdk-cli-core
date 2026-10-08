// Copyright (c) 2026 TDK Landscape contributors
// SPDX-License-Identifier: MIT
import { describe, expect, it } from "vitest";
import { summarizeTiltBuildError } from "../doctor-runtime.js";

const pullDenied = (image: string) =>
  `ImageBuild: ${image}: failed to resolve source metadata for docker.io/library/${image}: pull access denied, repository does not exist or may require authorization: server message: insufficient_scope: authorization failed`;

describe("summarizeTiltBuildError: missing golden base images", () => {
  it.each([
    ["shop-l1:latest", "shop-l1"],
    ["shop-l2:latest", "shop-l2"],
    ["shop-l3-migrator:latest", "shop-l3-migrator"],
    ["shop-l4-backend:latest", "shop-l4-backend"],
    ["shop-l4-backend-node:latest", "shop-l4-backend-node"],
    ["my-erp-system-l3-frontend:latest", "my-erp-system-l3-frontend"],
    ["tdk-project-l1:latest", "tdk-project-l1"],
  ])("names %s and explains the golden layers were missing", (image, name) => {
    const summary = summarizeTiltBuildError(pullDenied(image));
    expect(summary).toContain(`base image ${name} was missing when this build started`);
    expect(summary).toContain("does not retry");
  });

  it("does not mislabel other images that fail to resolve", () => {
    const summary = summarizeTiltBuildError(pullDenied("someorg-private-thing:latest"));
    expect(summary).not.toContain("golden");
  });

  it("does not mislabel a public base image", () => {
    const summary = summarizeTiltBuildError(pullDenied("node:22-alpine"));
    expect(summary).not.toContain("golden");
  });
});
