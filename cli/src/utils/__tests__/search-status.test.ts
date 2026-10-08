// Copyright (c) 2026 TDK Landscape contributors
// SPDX-License-Identifier: MIT
import { describe, expect, it } from "vitest";
import { describeSearch } from "../search-status.js";

describe("describeSearch", () => {
  it("returns null without a query", () => {
    expect(describeSearch("", 5, 5)).toBeNull();
  });

  it("reports matches out of total", () => {
    expect(describeSearch("api", 2, 5)).toEqual({ summary: "2 of 5" });
  });

  it("explains an empty result", () => {
    expect(describeSearch("zzz", 0, 5)).toEqual({
      summary: "0 matches",
      emptyMessage: 'No resources match "zzz". Press Esc to clear.',
    });
  });
});
