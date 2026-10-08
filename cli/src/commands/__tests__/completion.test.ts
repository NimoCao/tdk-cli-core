// Copyright (c) 2026 TDK Landscape contributors
// SPDX-License-Identifier: MIT
import { describe, expect, it, vi } from "vitest";
import { completionCommand } from "../completion.js";

describe("tdk completion", () => {
  it.each(["bash", "zsh", "fish", "powershell"])(
    "generates a non-empty %s script with doctor and resource completions",
    async (shell) => {
      const log = vi.spyOn(console, "log").mockImplementation(() => {});

      try {
        await completionCommand.parseAsync(["node", "tdk", "--shell", shell], { from: "node" });

        const script = log.mock.calls.map(([value]) => String(value)).join("\n");
        expect(script.trim()).not.toBe("");
        expect(script).toContain("doctor");
        expect(script).toContain("resource");
      } finally {
        log.mockRestore();
      }
    },
  );

  it("reports an unsupported shell and exits with status 1", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const exit = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);

    try {
      await completionCommand.parseAsync(["node", "tdk", "--shell", "bogus"], { from: "node" });

      expect(error).toHaveBeenCalledWith(expect.stringContaining("Unsupported shell: bogus"));
      expect(log).toHaveBeenCalledWith(
        expect.stringContaining("Supported shells: bash, zsh, fish, powershell"),
      );
      expect(exit).toHaveBeenCalledWith(1);
    } finally {
      error.mockRestore();
      log.mockRestore();
      exit.mockRestore();
    }
  });
});
