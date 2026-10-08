// Copyright (c) 2026 TDK Landscape contributors
// SPDX-License-Identifier: MIT
import { existsSync, readFileSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
// Mirrors discovery/json_manifest_scanner.star: every `discovery.paths` entry is a shell
// glob of directories, and `find -maxdepth 3` looks for service.json under each match. So a
// resource is only seen by Tilt if some directory matching a pattern is the resource
// directory itself or at most this many levels above it.
const MAX_LEVELS_BELOW_MATCH = 2;
const DEFAULT_DISCOVERY_PATHS = ["services/*/*"];
function segments(path) {
    return path.split(sep).filter(Boolean);
}
function segmentMatches(pattern, name) {
    const source = pattern
        .replace(/[.+^${}()|[\]\\]/g, "\\$&")
        .replace(/\*/g, "[^/]*")
        .replace(/\?/g, "[^/]");
    return new RegExp(`^${source}$`).test(name);
}
function globMatchesDir(patternSegments, dirSegments) {
    return (patternSegments.length === dirSegments.length &&
        patternSegments.every((segment, index) => segmentMatches(segment, dirSegments[index])));
}
/** `discovery.paths` from .tdk/project.json, or the generic default when unset/unreadable. */
export function readDiscoveryPaths(projectRoot) {
    const configPath = join(projectRoot, ".tdk", "project.json");
    if (!existsSync(configPath))
        return DEFAULT_DISCOVERY_PATHS;
    try {
        const paths = JSON.parse(readFileSync(configPath, "utf-8"))?.discovery?.paths;
        if (Array.isArray(paths) && paths.every((p) => typeof p === "string"))
            return paths;
    }
    catch { }
    return DEFAULT_DISCOVERY_PATHS;
}
/** Whether Tilt's discovery would find a service.json in `resourceDir` given `patterns`. */
export function isPathDiscovered(projectRoot, resourceDir, patterns) {
    const resourceSegments = segments(relative(projectRoot, resolve(projectRoot, resourceDir)));
    return patterns.some((pattern) => {
        const patternSegments = segments(relative(projectRoot, resolve(projectRoot, pattern)));
        for (let levels = 0; levels <= MAX_LEVELS_BELOW_MATCH; levels++) {
            const depth = resourceSegments.length - levels;
            if (depth > 0 && globMatchesDir(patternSegments, resourceSegments.slice(0, depth))) {
                return true;
            }
        }
        return false;
    });
}
/**
 * Picks the folder for a new resource without an explicit --path. The conventional folder
 * per type (apps/, workers/, packages/) is kept when discovery covers it; otherwise the
 * resource goes under services/<stack>/, which the default discovery paths cover, because a
 * resource outside every discovery path is scaffolded but never started by `tdk up`.
 */
export function chooseResourcePath(projectRoot, conventionalPath, stack, name) {
    const patterns = readDiscoveryPaths(projectRoot);
    if (isPathDiscovered(projectRoot, conventionalPath, patterns)) {
        return { path: conventionalPath };
    }
    const fallback = `services/${stack}/${name}`;
    if (isPathDiscovered(projectRoot, fallback, patterns)) {
        return { path: fallback, adjustedFrom: conventionalPath };
    }
    return { path: conventionalPath };
}
//# sourceMappingURL=discovery-paths.js.map