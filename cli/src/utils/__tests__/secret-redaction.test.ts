// Copyright (c) 2026 TDK Landscape contributors
// SPDX-License-Identifier: MIT
import * as fs from "node:fs";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  EnvUnreadableError,
  envSecretValues,
  MIN_REDACTED_VALUE_LENGTH,
  REDACTED,
  redactSecrets,
  redactValue,
} from "../secret-redaction.js";

const dirs: string[] = [];

function projectWithEnv(content: string | undefined): string {
  const root = mkdtempSync(join(tmpdir(), "tdk-redact-"));
  dirs.push(root);
  if (content !== undefined) writeFileSync(join(root, ".env"), content);
  return root;
}

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("envSecretValues", () => {
  it("returns long .env values, longest first, without quotes", () => {
    const root = projectWithEnv(
      [
        "DB_PASSWORD=a241b2b4adefe26480f645906b988454",
        'DATABASE_URL="postgresql://app:a241b2b4adefe26480f645906b988454@postgres:5432/app"',
        "PORT=4000",
        "# COMMENT=longer-than-eight-but-commented",
      ].join("\n"),
    );
    expect(envSecretValues(root)).toEqual([
      "postgresql://app:a241b2b4adefe26480f645906b988454@postgres:5432/app",
      "a241b2b4adefe26480f645906b988454",
    ]);
  });

  it("skips values shorter than the minimum so ordinary words are not masked", () => {
    const short = "x".repeat(MIN_REDACTED_VALUE_LENGTH - 1);
    expect(envSecretValues(projectWithEnv(`TOKEN=${short}\n`))).toEqual([]);
  });

  it("throws EnvUnreadableError when .env exists but cannot be read", () => {
    const root = projectWithEnv("TOKEN=abcdefghijk\n");
    fs.chmodSync(join(root, ".env"), 0o000);
    if (process.getuid?.() === 0) return; // root reads any file, so the permission case cannot be set up
    expect(() => envSecretValues(root)).toThrow(EnvUnreadableError);
    fs.chmodSync(join(root, ".env"), 0o600);
  });

  it("returns nothing when there is no .env file", () => {
    expect(envSecretValues(projectWithEnv(undefined))).toEqual([]);
  });
});

describe("redactSecrets", () => {
  it("masks every occurrence of each secret", () => {
    expect(redactSecrets("pw=hunter2hunter2 again hunter2hunter2", ["hunter2hunter2"])).toBe(
      `pw=${REDACTED} again ${REDACTED}`,
    );
  });

  it("masks a value that contains another secret as one piece", () => {
    const secrets = ["postgresql://app:secretsecret@db/app", "secretsecret"];
    expect(redactSecrets("url postgresql://app:secretsecret@db/app", secrets)).toBe(
      `url ${REDACTED}`,
    );
  });
});

describe("redactValue", () => {
  it("redacts nested strings and keeps the structure and non-string values", () => {
    const report = {
      schemaVersion: 1,
      data: { checks: [{ name: "DB", message: "password is secretsecret", didPass: true }] },
      errors: [],
      count: 3,
    };
    expect(redactValue(report, ["secretsecret"])).toEqual({
      schemaVersion: 1,
      data: { checks: [{ name: "DB", message: `password is ${REDACTED}`, didPass: true }] },
      errors: [],
      count: 3,
    });
  });

  it("returns the input untouched when there is nothing to redact", () => {
    const value = { a: "b" };
    expect(redactValue(value, [])).toBe(value);
  });
});
