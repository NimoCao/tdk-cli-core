// Copyright (c) 2026 TDK Landscape contributors
// SPDX-License-Identifier: MIT
import { describe, expect, it } from "vitest";
import { errorFactories } from "../errors.js";
import { toMachineError } from "../machine-output.js";

describe("not-found error suggestions", () => {
  it("suggests a close stack name while retaining existing guidance", () => {
    const error = errorFactories.stackNotFound("shp", ["shop", "api"]);

    expect(error.message).toBe('Stack "shp" not found');
    expect(error.suggestions).toEqual([
      'Did you mean "shop"?',
      "Run `tdk stacks` to see available stacks",
      "Run `tdk stack` to assign resources to a stack",
    ]);
  });

  it("suggests a close resource name while retaining existing guidance", () => {
    const error = errorFactories.resourceNotFound("aip", ["api", "web"]);

    expect(error.message).toBe('Resource "aip" not found');
    expect(error.suggestions).toEqual([
      'Did you mean "api"?',
      "Run `tdk resources` to list all resources",
      "Check the resource name spelling",
    ]);
  });

  it("keeps the current suggestions when no candidate is close", () => {
    const error = errorFactories.stackNotFound("missing", ["api", "web"]);

    expect(error.suggestions).toEqual([
      "Run `tdk stacks` to see available stacks",
      "Run `tdk stack` to assign resources to a stack",
    ]);
  });

  it("uses the same suggestion format for unknown services", () => {
    const error = errorFactories.unknownServices(["widgt"], ["widget"]);

    expect(error.message).toBe("Unknown service widgt. Valid names: widget");
    expect(error.exitCode).toBe(2);
    expect(error.suggestions).toEqual(['Did you mean "widget"?']);
  });

  it("pairs each suggestion with its unknown service", () => {
    const error = errorFactories.unknownServices(["widgt", "widge"], ["widget"]);

    expect(error.suggestions).toEqual([
      'Did you mean "widget" for "widgt"?',
      'Did you mean "widget" for "widge"?',
    ]);
  });
  it("preserves usage exit codes in machine-readable errors", () => {
    const error = errorFactories.unknownServices(["widgt"], ["widget"]);

    expect(toMachineError(error).exitCode).toBe(2);
  });

  it("preserves suggestions in machine-readable errors", () => {
    const error = errorFactories.stackNotFound("shp", ["shop"]);

    expect(toMachineError(error).error).toMatchObject({
      code: "COMMAND_FAILED",
      message: 'Stack "shp" not found',
      suggestions: expect.arrayContaining(['Did you mean "shop"?']),
    });
  });
});
