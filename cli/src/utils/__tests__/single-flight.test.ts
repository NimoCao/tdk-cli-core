// Copyright (c) 2026 TDK Landscape contributors
// SPDX-License-Identifier: MIT
import { describe, expect, it } from "vitest";
import { singleFlight } from "../single-flight.js";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("singleFlight", () => {
  it("applies the result of a load", async () => {
    const applied: string[] = [];
    const run = singleFlight<string>((value) => applied.push(value));
    await run(async () => "a");
    expect(applied).toEqual(["a"]);
  });

  it("starts nothing while a load is still running", async () => {
    const applied: string[] = [];
    let started = 0;
    const run = singleFlight<string>((value) => applied.push(value));
    const slow = deferred<string>();

    const first = run(() => {
      started += 1;
      return slow.promise;
    });
    await run(async () => {
      started += 1;
      return "skipped";
    });
    slow.resolve("slow result");
    await first;

    expect(started).toBe(1);
    expect(applied).toEqual(["slow result"]);
  });

  it("still updates when every load outlasts the timer tick", async () => {
    const applied: number[] = [];
    const run = singleFlight<number>((value) => applied.push(value));
    const loads = [deferred<number>(), deferred<number>(), deferred<number>()];
    let next = 0;
    const tick = () => run(() => loads[next++]?.promise ?? Promise.resolve(-1));

    const a = tick(); // starts load 0
    void tick(); // tick while load 0 runs: skipped
    loads[0]?.resolve(10);
    await a;
    const b = tick(); // starts load 1
    void tick(); // skipped
    loads[1]?.resolve(20);
    await b;

    expect(applied).toEqual([10, 20]);
  });

  it("allows the next load after one fails", async () => {
    const applied: string[] = [];
    const run = singleFlight<string>((value) => applied.push(value));
    const failing = deferred<string>();

    const first = run(() => failing.promise);
    failing.reject(new Error("tilt exploded"));
    await expect(first).rejects.toThrow("tilt exploded");
    await run(async () => "recovered");

    expect(applied).toEqual(["recovered"]);
  });
});
