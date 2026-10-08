// Copyright (c) 2026 TDK Landscape contributors
// SPDX-License-Identifier: MIT
import { describe, expect, it } from "vitest";
import {
  createKebabCaseValidator,
  isValidPort,
  validateResourceName,
} from "../../utils/validation.js";

describe("error handling", () => {
  describe("resource name validation", () => {
    it("should validate resource names using actual validation utility", () => {
      expect(validateResourceName("my-service")).toEqual({ valid: true });
      expect(validateResourceName("service123")).toEqual({ valid: true });
      expect(validateResourceName("api-gateway")).toEqual({ valid: true });

      expect(validateResourceName("")).toEqual({
        valid: false,
        error: "Resource name is required",
      });
      expect(validateResourceName("MyService")).toEqual({
        valid: false,
        error:
          'Resource name "MyService" is not valid. Use lowercase letters, numbers, and hyphens only, e.g. "my-service".',
      });
      expect(validateResourceName("my_service")).toEqual({
        valid: false,
        error:
          'Resource name "my_service" is not valid. Use lowercase letters, numbers, and hyphens only, e.g. "my-service".',
      });
    });

    it("should create kebab-case validators for different contexts", () => {
      const resourceValidator = createKebabCaseValidator("resource");
      const stackValidator = createKebabCaseValidator("stack");

      expect(resourceValidator("my-resource")).toBe(true);
      expect(resourceValidator("")).toBe("Resource name is required");
      expect(resourceValidator("MyResource")).toBe(
        'Resource name "MyResource" is not valid. Use lowercase letters, numbers, and hyphens only, e.g. "my-service".',
      );

      expect(stackValidator("my-stack")).toBe(true);
      expect(stackValidator("")).toBe("Stack name is required");
      expect(stackValidator("MyStack")).toBe(
        'Stack name "MyStack" is not valid. Use lowercase letters, numbers, and hyphens only, e.g. "my-stack".',
      );
    });
  });

  describe("port assignment", () => {
    it("should validate port is within valid range using isValidPort", () => {
      // Valid ports (isValidPort allows ports 1-65535, not just 1024+)
      expect(isValidPort(3000)).toBe(true);
      expect(isValidPort(8080)).toBe(true);
      expect(isValidPort(1024)).toBe(true);
      expect(isValidPort(1)).toBe(true); // Valid per isValidPort (just > 0)
      expect(isValidPort(65535)).toBe(true);

      // Invalid ports
      expect(isValidPort(65536)).toBe(false);
      expect(isValidPort(0)).toBe(false);
      expect(isValidPort(-1)).toBe(false);
    });
  });

  describe("stack name validation", () => {
    it("should validate stack name format using createKebabCaseValidator", () => {
      const validNames = ["main", "api-services", "v1-stack", "test123"];

      const invalidNames = ["My Stack", "my_stack", "MyStack", ""];

      const stackValidator = createKebabCaseValidator("stack");

      for (const name of validNames) {
        expect(stackValidator(name)).toBe(true);
      }

      for (const name of invalidNames) {
        expect(typeof stackValidator(name)).toBe("string");
      }
    });
  });
});
