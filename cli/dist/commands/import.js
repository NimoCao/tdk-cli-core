// Copyright (c) 2026 TDK Landscape contributors
// SPDX-License-Identifier: MIT
import { spawn } from "node:child_process";
import { Command } from "commander";
/**
 * The importer lives in its own repo so detectors can ship without a CLI release. Until it is
 * published to npm it is run from git; `TDK_IMPORT_PACKAGE` overrides the package spec.
 */
export const IMPORT_PACKAGE = "github:tdk-landscape/tdk-import";
export function importInvocation(args, env = process.env, platform = process.platform) {
    const pkg = env.TDK_IMPORT_PACKAGE || IMPORT_PACKAGE;
    return {
        command: platform === "win32" ? "npx.cmd" : "npx",
        args: ["--yes", pkg, ...args],
        shell: platform === "win32",
    };
}
/** Runs tdk-import with the caller's terminal and resolves to its exit code. */
export function runImport(args, spawnFn = spawn) {
    const invocation = importInvocation(args);
    return new Promise((resolve) => {
        const child = spawnFn(invocation.command, invocation.args, {
            stdio: "inherit",
            shell: invocation.shell,
        });
        child.on("error", (err) => {
            console.error(`tdk import: could not run npx (${err.message}). Install Node.js/npm and retry.`);
            resolve(127);
        });
        child.on("close", (code) => resolve(code ?? 1));
    });
}
export const importCommand = new Command("import")
    .description("Import the services a directory describes (runs tdk-import)")
    .argument("[args...]", "Passed to tdk-import: [dir] --dry-run --yes --force --only <ids>")
    .allowUnknownOption()
    .helpOption(false)
    .action(async (args) => {
    process.exitCode = await runImport(args);
});
//# sourceMappingURL=import.js.map