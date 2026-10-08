// Copyright (c) 2026 TDK Landscape contributors
// SPDX-License-Identifier: MIT
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { checkDockerCompose, checkDockerRuntime, checkDockerVersions, checkTilt, } from "../commands/doctor.js";
import { BUN_FLOOR_LABEL, bunMeetsFloor } from "./bun-floor.js";
import { projectNeedsBun } from "./bun-requirement.js";
import { checkNatsBroker } from "./doctor-wiring.js";
import { getHostPortPlan } from "./host-port-config.js";
import { findProjectRoot } from "./paths.js";
import { discoverResourcesFromRoot } from "./services.js";
import { findOnPath } from "./which.js";
/** Converts a doctor check result into the preflight's compact display item. */
function item(id, result) {
    return {
        id,
        ok: result.didPass || Boolean(result.isSkipped),
        message: result.message,
        fix: result.fix,
    };
}
/** Returns whether a Node version is below the CLI's 22.12 minimum. */
export function nodeTooOld(version) {
    const [major = 0, minor = 0] = String(version)
        .split(".")
        .map((part) => Number.parseInt(part, 10));
    return (!Number.isFinite(major) || !Number.isFinite(minor) || major < 22 || (major === 22 && minor < 12));
}
async function safeCheck(id, check, fallback) {
    try {
        return item(id, await check());
    }
    catch {
        return { id, ok: false, message: fallback };
    }
}
/** Requires a Docker engine and Compose version check to complete successfully. */
export function requireVerifiedDockerVersions(result) {
    if (!result.isSkipped)
        return result;
    return {
        ...result,
        didPass: false,
        isSkipped: false,
        message: `Could not verify Docker Engine/Compose minimum versions: ${result.message}`,
        fix: result.fix ?? "Start Docker and ensure Docker Engine 25+ and Compose 2.20.2+ are installed.",
    };
}
function usesPrisma(projectRoot) {
    try {
        return discoverResourcesFromRoot(projectRoot).some((resource) => {
            return resource.config?.featuresEnabled?.includes("prisma") ?? false;
        });
    }
    catch {
        return false;
    }
}
export async function runColdPreflight(opts = {}) {
    const cwd = opts.cwd ?? process.cwd();
    const projectRoot = findProjectRoot(cwd);
    const inProject = Boolean(projectRoot);
    const items = [];
    const nodeVersion = process.versions.node;
    items.push({
        id: "node",
        ok: !nodeTooOld(nodeVersion),
        message: nodeVersion,
        fix: nodeTooOld(nodeVersion)
            ? `Install Node.js 22.12+ (current: ${nodeVersion}). https://nodejs.org`
            : undefined,
    });
    items.push(await safeCheck("docker", checkDockerRuntime, "Docker daemon is not running"));
    items.push(await safeCheck("compose", async () => {
        const [compose, versions] = await Promise.all([
            checkDockerCompose(),
            checkDockerVersions(),
        ]);
        if (!compose.didPass)
            return compose;
        return requireVerifiedDockerVersions(versions);
    }, "Docker Engine or Compose version check failed"));
    items.push(await safeCheck("tilt", checkTilt, "Tilt CLI not found"));
    // Outside a project Bun stays required: `tdk project` is about to create services that need it.
    const bunNeeded = projectRoot ? projectNeedsBun(discoverResourcesFromRoot(projectRoot)) : true;
    let bun = false;
    const bunPath = bunNeeded ? findOnPath("bun") : undefined;
    if (bunPath) {
        try {
            const version = execFileSync(bunPath, ["--version"], {
                encoding: "utf-8",
                timeout: 3000,
            }).trim();
            bun = bunMeetsFloor(version);
        }
        catch {
            /* reported as a failed runtime check */
        }
    }
    items.push(bunNeeded
        ? {
            id: "bun",
            ok: bun,
            message: bun
                ? `Bun ${BUN_FLOOR_LABEL} is available on PATH`
                : `Bun ${BUN_FLOOR_LABEL} not found on PATH`,
            fix: bun ? undefined : "curl -fsSL https://bun.sh/install | bash",
        }
        : { id: "bun", ok: true, message: "Bun not needed: no generated JS services" });
    try {
        const plan = await getHostPortPlan(projectRoot ?? cwd);
        items.push({
            id: "ports",
            ok: true,
            message: `HTTP ${plan.ingressHttp}, HTTPS ${plan.ingressHttps}, Postgres ${plan.postgres}`,
        });
    }
    catch (error) {
        items.push({
            id: "ports",
            ok: false,
            message: error instanceof Error ? error.message : String(error),
            fix: "Set TDK_HTTP_PORT, TDK_HTTPS_PORT, or TDK_POSTGRES_PORT to available host ports.",
        });
    }
    if (projectRoot) {
        const nats = await safeCheck("nats", () => checkNatsBroker(projectRoot), "NATS broker check failed");
        if (!nats.ok)
            items.push(nats);
        if (usesPrisma(projectRoot)) {
            let dbUp = false;
            try {
                const config = JSON.parse(readFileSync(join(projectRoot, ".tdk", "project.json"), "utf-8"));
                const projectName = String(config?.project?.name ?? "").replace(/-/g, "_");
                if (projectName) {
                    const running = execFileSync(findOnPath("docker") ?? "docker", [
                        "ps",
                        "--filter",
                        `label=com.docker.compose.project=${projectName}`,
                        "--filter",
                        "label=com.docker.compose.service=postgres",
                        "--filter",
                        "health=healthy",
                        "--format",
                        "{{.Names}}",
                    ], { encoding: "utf-8", timeout: 3000 }).trim();
                    dbUp = running.length > 0;
                }
            }
            catch {
                /* Docker unavailable is already represented by the machine checks. */
            }
            if (!dbUp)
                items.push({
                    id: "prisma",
                    ok: false,
                    message: "A Prisma resource is configured, but the project Postgres service is not healthy",
                    fix: "Run `tdk up` to start the bundled Postgres, then check `tdk doctor`.",
                });
        }
    }
    const failures = items.filter((check) => !check.ok).slice(0, 8);
    const machineFailed = failures.some((check) => ["node", "docker", "compose", "tilt", "bun", "ports"].includes(check.id));
    const bunFailed = failures.some((check) => check.id === "bun");
    const header = failures.length
        ? machineFailed
            ? bunFailed
                ? `Cold start blocked. Bun ${BUN_FLOOR_LABEL} must be installed on PATH.\nPrisma/NATS configuration is project-specific and generated after \`tdk project\`. Fix the machine checks below.`
                : "Cold start blocked. Bun/Prisma/NATS are not the first failure.\nThey are generated after `tdk project`. Fix the machine checks below."
            : "Machine is ready. Project wiring is not."
        : "";
    const footer = failures.length
        ? ""
        : inProject
            ? "Environment ready for TDK"
            : "This machine is ready for TDK.\nNext: tdk project --yes";
    return { ok: failures.length === 0, inProject, items: failures, header, footer };
}
/** Formats only failed preflight checks and the applicable readiness message. */
export function formatColdPreflight(result, options = {}) {
    const lines = [result.header];
    for (const check of result.items) {
        lines.push(`FAIL ${check.id.padEnd(7)} ${check.message}`);
        if (check.fix)
            lines.push(`  ${check.fix}`);
    }
    if (result.footer && (options.includeSuccessFooter ?? true))
        lines.push(result.footer);
    return lines.filter(Boolean).join("\n");
}
/** Exits before machine-dependent command work when any machine check fails. */
export async function assertMachineReadyOrExit() {
    const result = await runColdPreflight();
    const machineFailure = result.items.some((check) => ["node", "docker", "compose", "tilt", "bun", "ports"].includes(check.id));
    if (machineFailure) {
        console.error(formatColdPreflight(result));
        process.exit(1);
    }
}
//# sourceMappingURL=cold-preflight.js.map