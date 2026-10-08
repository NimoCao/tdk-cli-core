// Copyright (c) 2026 TDK Landscape contributors
// SPDX-License-Identifier: MIT
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const apiPaths = JSON.stringify(
  join(
    repoRoot,
    "engine",
    "topologies",
    "platform",
    "docker",
    "networking",
    "api_path_constants.star",
  ),
);

const hasTilt = spawnSync("tilt", ["version"], { encoding: "utf-8" }).status === 0;
if (process.env.TDK_REQUIRE_TILT === "1" && !hasTilt) {
  throw new Error("Tilt is required for the API path Starlark tests in CI.");
}

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function evaluate(source: string) {
  const dir = mkdtempSync(join(tmpdir(), "tdk-api-paths-"));
  dirs.push(dir);
  const tiltfile = join(dir, "Tiltfile");
  writeFileSync(tiltfile, source);
  return spawnSync("tilt", ["alpha", "tiltfile-result", "-f", tiltfile], {
    cwd: repoRoot,
    encoding: "utf-8",
    timeout: 25000,
  });
}

describe.skipIf(!hasTilt)("api_path_constants.star", { timeout: 40_000 }, () => {
  // These are the helpers that are really used (compose, Vite and the Traefik helpers import them). Their behaviour must not change
  // when the dead lookup code around them is removed.
  it("keeps the stack API path, the apiPath override and the resource-name rules", () => {
    const result =
      evaluate(`load(${apiPaths}, 'get_api_path_for_stack', 'get_api_path_for_domain', 'get_api_path_for_resource', 'get_api_path_for_service')
if get_api_path_for_stack('shop') != '/api/shop-management': fail('stack path changed: ' + get_api_path_for_stack('shop'))
if get_api_path_for_domain('shop') != '/api/shop-management': fail('the domain alias changed')
if get_api_path_for_stack('shop', {'apiPath': '/custom'}) != '/custom': fail('the apiPath override was lost')
if get_api_path_for_resource('orders-backend') != '/api/orders-management': fail('resource rule changed: ' + get_api_path_for_resource('orders-backend'))
if get_api_path_for_service('orders-backend') != '/api/orders-management': fail('the service alias changed')
`);
    expect(`${result.stdout}${result.stderr}`).not.toMatch(/Error in fail/);
    expect(result.status, result.stderr).toBe(0);
  });

  // Nothing populated these maps, so every helper that read them answered from an empty dict: get_all_api_paths() was always [],
  // is_valid_api_path() always False, get_stack_for_api_path() always "". A silently wrong helper is worse than a missing one.
  it("no longer offers lookups that read maps nothing ever fills", () => {
    const dead = [
      "get_all_api_paths",
      "is_valid_api_path",
      "get_stack_for_api_path",
      "get_domain_for_api_path",
      "RESOURCE_STACK_TO_API_PATH",
      "API_PATH_TO_RESOURCE_STACK",
      "API_PATH_TO_RESOURCE_DOMAIN",
      "LEGACY_DOMAIN_TO_API_PATH",
      "RESOURCE_DOMAIN_TO_API_PATH",
    ];
    for (const name of dead) {
      const result = evaluate(`load(${apiPaths}, '${name}')\n`);
      expect(result.status, `${name} should not be loadable any more`).not.toBe(0);
    }
  });
});
