// Copyright (c) 2026 TDK Landscape contributors
// SPDX-License-Identifier: MIT
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { DiscoveredResource } from "../types/index.js";
import { findProjectRoot } from "./paths.js";
import { isApiServiceType } from "./resource-kind.js";

export interface HealthTarget {
  name: string;
  appType: "frontend" | "backend" | "mcp";
  url: string;
}

export interface HealthProbe extends HealthTarget {
  ok: boolean;
  /** HTTP status code, or undefined when the request never completed. */
  status?: number;
  /** Failure reason when the request never completed (DNS, refused, timeout). */
  error?: string;
}

export function getProjectName(): string {
  const root = findProjectRoot();
  if (root) {
    try {
      const content = readFileSync(join(root, ".tdk", "project.json"), "utf-8");
      const parsed = JSON.parse(content);
      if (parsed?.project?.name) {
        return parsed.project.name;
      }
    } catch {}
  }
  return "tdk-project";
}

export function resolveSubdomainBases(ingressPort?: number): { appBase: string; apiBase: string } {
  const projectName = getProjectName();
  const raw =
    process.env.TDK_SERVICE_BASE_URL ??
    `http://${projectName}.localhost${ingressPort ? `:${ingressPort}` : ""}`;
  try {
    const u = new URL(raw.includes("://") ? raw : `http://${raw}`);
    const host = u.hostname;
    const port = u.port || (ingressPort ? String(ingressPort) : "");
    if (host === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(host)) {
      return {
        appBase: `${u.protocol}//${host}${port ? `:${port}` : ""}`,
        apiBase: `${u.protocol}//${host}${port ? `:${port}` : ""}`,
      };
    }
    const bare = host.replace(/^(app|api)\./, "");
    return {
      appBase: `${u.protocol}//app.${bare}${port ? `:${port}` : ""}`,
      apiBase: `${u.protocol}//api.${bare}${port ? `:${port}` : ""}`,
    };
  } catch {
    return {
      appBase: `http://app.${projectName}.localhost`,
      apiBase: `http://api.${projectName}.localhost`,
    };
  }
}

export function appendHealthPath(path: string): string {
  return `${path.replace(/\/+$/, "")}/health`;
}

/** The route `tdk up` advertises for a service, without the /health suffix. */
export function resolveServicePath(resource: DiscoveredResource): string {
  if (isApiServiceType(resource.config?.appType)) {
    const servicePathName = resource.name.replace(/-api$/, "");
    return resource.config?.apiPath ?? `/api/${servicePathName}`;
  }
  return resource.config?.basePath ?? `/${resource.name}`;
}

/**
 * Health URLs for every routable service, matching what `tdk up` prints.
 * Workers, libraries, SDKs and migrators have no Traefik route, so they are
 * skipped rather than reported as unreachable.
 */
export function buildHealthTargets(
  resources: DiscoveredResource[],
  ingressPort?: number,
): HealthTarget[] {
  const { appBase, apiBase } = resolveSubdomainBases(ingressPort);

  return resources
    .filter(
      (
        resource,
      ): resource is DiscoveredResource & { config: { appType: "frontend" | "backend" | "mcp" } } =>
        resource.config?.appType === "frontend" || isApiServiceType(resource.config?.appType),
    )
    .map((resource) => {
      const base = isApiServiceType(resource.config.appType) ? apiBase : appBase;
      return {
        name: resource.name,
        appType: resource.config.appType,
        url: `${base}${appendHealthPath(resolveServicePath(resource))}`,
      };
    });
}

export async function pingHealthTarget(
  target: HealthTarget,
  timeoutMs: number,
): Promise<HealthProbe> {
  try {
    const response = await fetch(target.url, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
    });
    return { ...target, ok: response.ok, status: response.status };
  } catch (err: unknown) {
    const error =
      err instanceof Error && err.name === "TimeoutError"
        ? `no response within ${timeoutMs}ms`
        : err instanceof Error
          ? err.message
          : String(err);
    return { ...target, ok: false, error };
  }
}

export async function pingHealthTargets(
  targets: HealthTarget[],
  timeoutMs: number,
): Promise<HealthProbe[]> {
  return Promise.all(targets.map((target) => pingHealthTarget(target, timeoutMs)));
}
