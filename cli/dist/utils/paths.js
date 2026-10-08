// Copyright (c) 2026 TDK Landscape contributors
// SPDX-License-Identifier: MIT
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { cwd } from "node:process";
import packageJson from "../../package.json" with { type: "json" };
export function findProjectRoot(startDir = cwd()) {
    let currentDir = resolve(startDir);
    const root = resolve("/");
    while (currentDir !== root) {
        if (existsSync(join(currentDir, ".tdk", "project.json"))) {
            return currentDir;
        }
        const parentDir = dirname(currentDir);
        if (parentDir === currentDir) {
            break;
        }
        currentDir = parentDir;
    }
    return null;
}
let packageCache = null;
function getPackageInfo() {
    if (packageCache) {
        return packageCache;
    }
    // Imported JSON is bundled by Bun compile, unlike a runtime fs lookup from $bunfs.
    const parsed = packageJson;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Invalid package.json: expected object");
    }
    const packageInfo = parsed;
    packageCache = {
        name: String(packageInfo.name ?? "@tdk-landscape/tdk-cli-core"),
        version: String(packageInfo.version ?? "0.0.0"),
        fullPackage: packageInfo,
    };
    return packageCache;
}
export function getPackageVersion() {
    return getPackageInfo().version;
}
//# sourceMappingURL=paths.js.map