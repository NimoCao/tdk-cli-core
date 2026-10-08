// Copyright (c) 2026 TDK Landscape contributors
// SPDX-License-Identifier: MIT
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createStatusMessageController } from "../status-message.js";

describe("status message controller", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps the newest message visible for its full duration", () => {
    const messages: string[] = [];
    const controller = createStatusMessageController((message) => messages.push(message));

    controller.show("Mouse support enabled", 2000);
    vi.advanceTimersByTime(1000);
    controller.show("Tooltips enabled", 1500);
    vi.advanceTimersByTime(1000);
    expect(messages).toEqual(["Mouse support enabled", "Tooltips enabled"]);
    vi.advanceTimersByTime(499);
    expect(messages).toEqual(["Mouse support enabled", "Tooltips enabled"]);
    vi.advanceTimersByTime(1);
    expect(messages).toEqual(["Mouse support enabled", "Tooltips enabled", ""]);
  });

  it("cancels the pending clear when the UI is disposed", () => {
    const messages: string[] = [];
    const controller = createStatusMessageController((message) => messages.push(message));
    controller.show("Press q to quit");
    vi.advanceTimersByTime(1000);
    controller.dispose();
    vi.advanceTimersByTime(1000);
    expect(messages).toEqual(["Press q to quit"]);
  });
});
