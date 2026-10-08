// Copyright (c) 2026 TDK Landscape contributors
// SPDX-License-Identifier: MIT
import chalk from "chalk";
import { Command } from "commander";
import { createDiscoveryContext } from "../utils/discovery-context.js";
import { getDeferredResourceNames } from "../utils/doctor-runtime.js";
import { runCommand } from "../utils/errors.js";
import { formatCount, showDetail, showStep } from "../utils/formatting.js";
import { getHostPortPlan } from "../utils/host-port-config.js";
import { createMachineEnvelope, writeMachineError } from "../utils/machine-output.js";
import { findProjectRoot } from "../utils/paths.js";
import { deriveServiceStates, type ServiceRuntimeState } from "../utils/service-runtime-state.js";
import { buildServicePorts, buildStackPorts } from "../utils/status-ports.js";
import { getTiltfilePath, isTiltAvailable, runTilt } from "../utils/tilt.js";
import { evaluateTiltReadiness, tiltGetUiResources } from "../utils/up-readiness.js";

export const statusCommand = new Command("status")
  .description("Show status of resources and stacks")
  .option("--json", "Output a versioned JSON status report", false)
  .option("-v, --verbose", "Show detailed information", false)
  .option("--stacks", "Show stack information (default)", true)
  .option("--resources", "Show all discovered resources", false)
  .option("--tilt", "Show tilt resource status", false)
  .action(async (options) => {
    const action = async (): Promise<void> => {
      // Discover first: outside a project this fails before any status line is printed.
      const discovery = createDiscoveryContext();
      let tiltAvailable = false;
      try {
        tiltAvailable = await isTiltAvailable();
      } catch {
        // Tilt not available (spawn error)
        tiltAvailable = false;
      }

      if (!options.json) {
        showStep("TDK Status\n");
        console.log(
          chalk.bold("Tilt:"),
          tiltAvailable ? chalk.green("available") : chalk.red("not found"),
        );

        if (!tiltAvailable) {
          showDetail("Install Tilt: https://docs.tilt.dev/install.html");
        }

        console.log();
      }

      let tiltResources: unknown = null;
      let queryError: string | null = null;
      if (options.json && options.tilt && tiltAvailable) {
        const result = await runTilt(
          "get",
          ["-f", getTiltfilePath(), "resources", "--output=json"],
          {
            inheritStdio: false,
          },
        );
        if (result.exitCode === 0) {
          try {
            tiltResources = JSON.parse(result.stdout);
          } catch (error) {
            queryError = `Tilt returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`;
          }
        } else {
          queryError = result.stderr || "Could not retrieve Tilt resource status";
        }
      }

      // A single look at the running Tilt, so a caller that started `tdk up` detached can poll for readiness. Null when no
      // Tilt answers or its output cannot be read.
      let readiness: ReturnType<typeof evaluateTiltReadiness>["result"] | null = null;
      // The same look at Tilt feeds readiness and each service's state, so `tdk status` and `tdk ui` cannot disagree.
      let serviceStates: Record<string, ServiceRuntimeState> | null = null;
      if (tiltAvailable) {
        const port = Number.parseInt(process.env.TILT_PORT ?? "", 10);
        const text = await tiltGetUiResources(Number.isInteger(port) ? port : 10350);
        if (text) {
          const deferred = getDeferredResourceNames();
          try {
            if (options.json) readiness = evaluateTiltReadiness(text, deferred).result;
          } catch {
            readiness = null;
          }
          try {
            serviceStates = deriveServiceStates(
              text,
              Object.fromEntries(
                discovery.resources.map((r) => [r.name, r.config?.dependsOn ?? []]),
              ),
              deferred,
            );
          } catch {
            serviceStates = null;
          }
        }
      }

      if (options.json) {
        let portPlan = null;
        try {
          const root = findProjectRoot();
          portPlan = root ? await getHostPortPlan(root, { inspectDocker: false }) : null;
        } catch {
          // Port planning is best effort; stack ports then list only the Tilt UI.
        }
        const errors = queryError ? [{ code: "TILT_STATUS_UNAVAILABLE", message: queryError }] : [];
        const data = {
          tilt: {
            available: tiltAvailable,
            resourcesQueried: options.tilt && tiltAvailable,
            resources: tiltResources,
            readiness,
          },
          resourceCount: discovery.resources.length,
          resources: discovery.resources.map((resource) => ({
            name: resource.name,
            stack: resource.stack ?? null,
            type: resource.type ?? "unknown",
            port: resource.port ?? null,
            ...buildServicePorts(resource, portPlan?.ingressHttp),
            status: serviceStates?.[resource.name]?.status ?? "unknown",
            ...(serviceStates?.[resource.name]?.reason
              ? { statusReason: serviceStates[resource.name]?.reason }
              : {}),
            ...(serviceStates?.[resource.name]?.blockedBy
              ? { blockedBy: serviceStates[resource.name]?.blockedBy }
              : {}),
          })),
          ports: buildStackPorts(
            portPlan,
            process.env.TILT_PORT ? Number.parseInt(process.env.TILT_PORT, 10) : undefined,
          ),
          stacks: discovery.stacks.map((stack) => ({
            name: stack.name,
            resourceCount: stack.resourceCount,
            resources: stack.resources.map((resource) => resource.name),
          })),
          unassignedResources: discovery.unassignedResources.map((resource) => resource.name),
        };
        console.log(JSON.stringify(createMachineEnvelope(data, errors)));
        if (errors.length > 0) {
          console.error(queryError);
          process.exit(1);
        }
        return;
      }

      console.log(chalk.bold("Resources:"), `${discovery.resources.length} discovered`);
      console.log(chalk.bold("Stacks:"), `${discovery.stacks.length} defined`);

      if (discovery.stacks.length > 0) {
        for (const stack of discovery.stacks) {
          const resourcesInStack = stack.resources.length;
          showDetail(`${stack.name}: ${formatCount(resourcesInStack, "resource")}`);

          if (options.verbose) {
            for (const resource of stack.resources) {
              showDetail(`${resource.name}`, 6);
            }
          }
        }
      }

      if (discovery.unassignedResources.length > 0) {
        console.log();
        console.log(
          chalk.yellow(
            `${formatCount(discovery.unassignedResources.length, "resource")} not in any stack:`,
          ),
        );

        if (options.verbose) {
          for (const resource of discovery.unassignedResources) {
            showDetail(`${resource.name}`);
          }
        }
      }

      if (serviceStates && Object.keys(serviceStates).length > 0) {
        console.log();
        console.log(chalk.bold("Services:"));
        for (const resource of discovery.resources) {
          const state = serviceStates[resource.name];
          if (!state) continue;
          const mark =
            state.status === "ready"
              ? chalk.green("✓")
              : state.status === "error"
                ? chalk.red("✗")
                : chalk.yellow("…");
          showDetail(
            `${mark} ${resource.name}  ${state.status}${state.reason ? ` (${state.reason})` : ""}`,
          );
        }
      }

      if (options.tilt && tiltAvailable) {
        console.log();
        showStep("Tilt Resources:");

        const tiltfilePath = getTiltfilePath();
        const result = await runTilt("get", ["-f", tiltfilePath, "resources"], {
          inheritStdio: false,
        });

        if (result.exitCode === 0) {
          console.log(result.stdout || chalk.gray("  No active tilt resources"));
        } else {
          showDetail("Could not retrieve tilt resource status");
        }
      }

      console.log();
      showDetail('Run "tdk stacks" to see all stacks.');
      showDetail('Run "tdk up <stack-name>" to start a stack.');
    };

    if (options.json) {
      try {
        await action();
      } catch (error) {
        writeMachineError(error);
      }
      return;
    }
    await runCommand(action);
  });
