// Copyright (c) 2026 TDK Landscape contributors
// SPDX-License-Identifier: MIT
/// <reference types="vite/client" />

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Command } from "commander";
import { describe, expect, it } from "vitest";
import { listedCommandNames } from "../help.js";

const srcDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

// Commands that exist for maintainers of this repository, not for people using TDK.
const NOT_LISTED = new Set(["maintainers"]);

const commandModules = import.meta.glob<Record<string, Command>>("../*.{ts,tsx}");

/** The commands `cli.ts` registers, found from its `import { xCommand } from "./commands/x.js"` lines. */
async function registeredCommands(): Promise<Command[]> {
  const source = readFileSync(join(srcDir, "cli.ts"), "utf-8");
  const imports = [
    ...source.matchAll(/import \{ (\w+Command) \} from "\.\/commands\/([\w-]+)\.js"/g),
  ];
  const commands: Command[] = [];
  for (const [, exportName, file] of imports) {
    const load = commandModules[`../${file}.ts`] ?? commandModules[`../${file}.tsx`];
    expect(load, `commands/${file} is imported by cli.ts`).toBeDefined();
    commands.push((await load())[exportName]);
  }
  return commands;
}

describe("tdk --help", () => {
  it("lists every command that cli.ts registers", async () => {
    const commands = await registeredCommands();
    expect(commands.length).toBeGreaterThan(15);

    const listed = new Set(listedCommandNames());
    const missing = commands
      .map((command) => command.name())
      .filter((name) => !NOT_LISTED.has(name) && !listed.has(name));

    expect(missing, "add a row to COMMAND_GROUPS in commands/help.ts").toEqual([]);
  });
});
