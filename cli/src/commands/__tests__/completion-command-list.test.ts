// Copyright (c) 2026 TDK Landscape contributors
// SPDX-License-Identifier: MIT
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { completionCommand } from "../completion.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const cliSource = readFileSync(join(repoRoot, "cli/src/cli.ts"), "utf8");
const commandImports = new Map(
  [...cliSource.matchAll(/import\s+\{\s*(\w+)\s*\}\s+from\s+["']\.\/commands\/([^"']+)["'];/g)].map(
    ([, variable, modulePath]) => [variable, modulePath],
  ),
);
const registeredCommandNames = [...cliSource.matchAll(/program\.addCommand\((\w+)\);/g)].map(
  ([, variable]) => {
    const modulePath = commandImports.get(variable);
    if (!modulePath) throw new Error(`Missing command import for ${variable}`);

    const sourceBase = join(repoRoot, "cli/src/commands", modulePath.replace(/\.js$/, ""));
    const sourcePath = [`${sourceBase}.ts`, `${sourceBase}.tsx`].find(existsSync);
    if (!sourcePath) throw new Error(`Cannot find command module for ${variable}`);
    const moduleSource = readFileSync(sourcePath, "utf8");
    const definition = moduleSource.match(/new\s+Command\s*\(\s*["']([^"']+)["']\s*\)/);
    if (!definition) throw new Error(`Cannot find Command name in ${sourcePath}`);
    return definition[1];
  },
);

async function renderCompletion(shell: string): Promise<string> {
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  try {
    await completionCommand.parseAsync(["node", "tdk", "--shell", shell], { from: "node" });
    return log.mock.calls.map(([value]) => String(value)).join("\n");
  } finally {
    log.mockRestore();
  }
}

function commandsIn(script: string, shell: string): string[] {
  if (shell === "bash") {
    const list = script.match(/local commands="([^"]+)"/);
    if (!list) throw new Error("Bash completion has no main command list");
    return list[1].split(/\s+/);
  }

  if (shell === "zsh") {
    const list = script.match(/_tdk_commands\(\)\s*\{([\s\S]*?)\n\}/);
    if (!list) throw new Error("Zsh completion has no command descriptions");
    return [...list[1].matchAll(/^\s*'([^:']+):/gm)].map(([, name]) => name);
  }

  const pattern = /complete -c tdk -n '__fish_use_subcommand' -a '([^']+)'/g;
  return [...script.matchAll(pattern)].map(([, name]) => name);
}

describe("top-level shell completions", () => {
  it.each(["bash", "zsh", "fish"])(
    "includes every command registered by cli.ts in the %s script",
    async (shell: string) => {
      const script = await renderCompletion(shell);
      const commandNames = commandsIn(script, shell);

      for (const commandName of registeredCommandNames) {
        expect(commandNames).toContain(commandName);
      }
      expect(commandNames).toContain("traefik");
    },
  );

  it("uses the help descriptions for config and networks", async () => {
    const zsh = await renderCompletion("zsh");
    const fish = await renderCompletion("fish");

    expect(zsh).toContain("config:Manage project configuration and regenerate master files");
    expect(zsh).toContain("networks:Show Traefik-routed URLs for all services");
    expect(fish).toContain(
      "-a 'config' -d 'Manage project configuration and regenerate master files'",
    );
    expect(fish).toContain("-a 'networks' -d 'Show Traefik-routed URLs for all services'");
  });
});
