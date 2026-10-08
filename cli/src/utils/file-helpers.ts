// Copyright (c) 2026 TDK Landscape contributors
// SPDX-License-Identifier: MIT
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import chalk from "chalk";
import type { FileGenerationTask } from "../types/index.js";

export function writeFilesWithProgress(
  basePath: string,
  tasks: FileGenerationTask[],
  onProgress?: (task: FileGenerationTask, index: number, total: number) => void,
): void {
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];

    console.log(chalk.blue(`${task.emoji} ${task.description}...`));

    if (task.type === "json") {
      writeJsonFileInDir(basePath, task.filename, task.content);
    } else {
      writeTextFileInDir(basePath, task.filename, String(task.content));
    }

    if (onProgress) {
      onProgress(task, i, tasks.length);
    }
  }
}

/**
 * Write JSON data to a file.
 * @param filePath - Path to the file
 * @param data - JSON-serializable data
 * @param space - Number of spaces for indentation (default: 2)
 */
export function writeJsonFile(filePath: string, data: unknown, space: number = 2): void {
  const content = `${JSON.stringify(data, null, space)}\n`;
  writeFileSync(filePath, content, "utf-8");
}

export function writeJsonFileInDir(
  dir: string,
  filename: string,
  data: unknown,
  space: number = 2,
): void {
  const filePath = resolve(dir, filename);
  writeJsonFile(filePath, data, space);
}

export function writeTextFile(filePath: string, content: string): void {
  writeFileSync(filePath, content, "utf-8");
}

export function writeTextFileInDir(dir: string, filename: string, content: string): void {
  const filePath = resolve(dir, filename);
  writeTextFile(filePath, content);
}

export function ensureDirectory(dirPath: string): void {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

/** Generated files that must never be committed: .env holds a generated DB password. */
const GITIGNORE_ENTRIES = [
  ".env",
  ".tdk/.tdk-out/",
  ".tdk/.project-id",
  ".tdk/smoke/",
  "node_modules/",
];

/**
 * Appends the TDK entries missing from the project's .gitignore (creating it
 * if needed), so the first `git add .` doesn't commit .env or generated
 * output. Returns the entries it added.
 */
export function ensureGitignore(projectRoot: string): string[] {
  const gitignorePath = resolve(projectRoot, ".gitignore");
  const existing = existsSync(gitignorePath) ? readFileSync(gitignorePath, "utf-8") : "";
  const lines = new Set(existing.split("\n").map((line) => line.trim().replace(/\/$/, "")));
  const missing = GITIGNORE_ENTRIES.filter((entry) => !lines.has(entry.replace(/\/$/, "")));
  if (missing.length === 0) return [];

  const prefix = existing && !existing.endsWith("\n") ? "\n" : "";
  const header = existing
    ? "\n# TDK (generated files and secrets)\n"
    : "# TDK (generated files and secrets)\n";
  appendFileSync(gitignorePath, `${prefix}${header}${missing.join("\n")}\n`);
  return missing;
}
