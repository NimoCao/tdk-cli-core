// Copyright (c) 2026 TDK Landscape contributors
// SPDX-License-Identifier: MIT
import type { DiscoveredResource, DiscoveryContext } from "../types/index.js";
import { createCacheValidator } from "./cache.js";
import { findProjectRoot } from "./paths.js";
import {
  discoverResources,
  discoverResourcesWithProblems,
  discoverStacks,
  getAllStacks,
  warnAboutSkippedFiles,
} from "./services.js";

let cachedContext: DiscoveryContext | null = null;
const cacheValidator = createCacheValidator(1000);

export function clearDiscoveryCache(): void {
  cachedContext = null;
  cacheValidator.reset();
}

function isCacheValid(): boolean {
  return cachedContext !== null && cacheValidator.isValid();
}

export function createDiscoveryContext(forceRefresh = false): DiscoveryContext {
  if (!forceRefresh && isCacheValid() && cachedContext) {
    return cachedContext;
  }

  const projectRoot = findProjectRoot();
  const { resources, problems } = projectRoot
    ? discoverResourcesWithProblems(projectRoot)
    : { resources: discoverResources(), problems: [] };
  const stacks = discoverStacks(resources);
  const stackNames = getAllStacks(resources);

  warnAboutSkippedFiles(problems);

  const unassignedResources = resources.filter((r) => !r.stack);

  const resourcesByStack = new Map<string, DiscoveredResource[]>();
  for (const resource of resources) {
    if (resource.stack) {
      const stackResources = resourcesByStack.get(resource.stack) || [];
      stackResources.push(resource);
      resourcesByStack.set(resource.stack, stackResources);
    }
  }

  const context: DiscoveryContext = {
    resources,
    problems,
    stacks,
    stackNames,
    unassignedResources,
    resourcesByStack,
  };

  cachedContext = context;
  cacheValidator.markUpdated();

  return context;
}
