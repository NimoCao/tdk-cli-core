// Copyright (c) 2026 TDK Landscape contributors
// SPDX-License-Identifier: MIT
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseEnv } from "./env-validator.js";
export const REDACTED = "[REDACTED]";
export class EnvUnreadableError extends Error {
    path;
    constructor(path, reason) {
        super(`Could not read ${path}: ${reason}`);
        this.path = path;
        this.name = "EnvUnreadableError";
    }
}
/**
 * Shorter values are left alone: masking a two-letter value would hit ordinary words in every log line. The cost is
 * that a short secret in .env is not masked, so keep real secrets at least this long.
 */
export const MIN_REDACTED_VALUE_LENGTH = 8;
/**
 * Values of the project's own .env file, longest first so a value that contains another is masked whole. Throws when the
 * file exists but cannot be read: continuing without the values would print secrets unmasked.
 */
export function envSecretValues(projectRoot) {
    const envPath = join(projectRoot, ".env");
    if (!existsSync(envPath))
        return [];
    let content;
    try {
        content = readFileSync(envPath, "utf-8");
    }
    catch (error) {
        throw new EnvUnreadableError(envPath, error instanceof Error ? error.message : String(error));
    }
    const values = [...parseEnv(content).values()].filter((value) => value.length >= MIN_REDACTED_VALUE_LENGTH);
    return [...new Set(values)].sort((a, b) => b.length - a.length);
}
export function redactSecrets(text, secrets) {
    let result = text;
    for (const secret of secrets)
        result = result.split(secret).join(REDACTED);
    return result;
}
/** Redacts every string inside a JSON-shaped value, so the output stays valid JSON. */
export function redactValue(value, secrets) {
    if (secrets.length === 0)
        return value;
    if (typeof value === "string")
        return redactSecrets(value, secrets);
    if (Array.isArray(value))
        return value.map((item) => redactValue(item, secrets));
    if (value !== null && typeof value === "object") {
        return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redactValue(item, secrets)]));
    }
    return value;
}
//# sourceMappingURL=secret-redaction.js.map