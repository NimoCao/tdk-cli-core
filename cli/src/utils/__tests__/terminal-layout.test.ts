// Copyright (c) 2026 TDK Landscape contributors
// SPDX-License-Identifier: MIT
import { describe, expect, it } from "vitest";
import {
  getListRowFromMouseY,
  getTabBarDensity,
  getTerminalRuleWidth,
} from "../terminal-layout.js";

describe("terminal layout helpers", () => {
  it.each([
    [60, 56],
    [80, 76],
    [120, 100],
    [2, 0],
  ])("sizes terminal rules at %i columns", (terminalWidth, expected) => {
    expect(getTerminalRuleWidth(terminalWidth)).toBe(expected);
  });

  it.each([
    [60, "compact"],
    [80, "standard"],
    [120, "wide"],
  ] as const)("chooses a tab density at %i columns", (terminalWidth, expected) => {
    expect(getTabBarDensity(terminalWidth)).toBe(expected);
  });

  it.each([
    [8, 7, 0],
    [9, 7, 1],
    [12, 10, 1],
    [7, 7, -1],
  ])("maps terminal row %i against list top %i", (mouseY, listTop, expected) => {
    expect(getListRowFromMouseY(mouseY, listTop)).toBe(expected);
  });
});
