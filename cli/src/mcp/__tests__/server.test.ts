// Copyright (c) 2026 TDK Landscape contributors
// SPDX-License-Identifier: MIT
import { describe, expect, it } from "vitest";
import { createMcpServer, type McpTool } from "../server.js";

const echo: McpTool = {
  name: "echo",
  description: "echo",
  inputSchema: { type: "object", properties: {} },
  handler: async (args) => ({ data: { got: args }, isError: false }),
};
const boom: McpTool = {
  ...echo,
  name: "boom",
  handler: async () => Promise.reject(new Error("kaput")),
};
const server = createMcpServer([echo, boom], { name: "tdk", version: "1.0.0" });

interface Response {
  // biome-ignore lint/suspicious/noExplicitAny: tests read arbitrary result shapes
  result: any;
  error: { code: number; message: string };
}

async function call(message: unknown): Promise<Response> {
  const line = await server.handleLine(JSON.stringify(message));
  return (line === null ? null : JSON.parse(line)) as Response;
}

describe("mcp server", () => {
  it("negotiates the protocol version and advertises tools only", async () => {
    const res = await call({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-03-26" },
    });
    expect(res.result.protocolVersion).toBe("2025-03-26");
    expect(res.result.capabilities).toEqual({ tools: { listChanged: false } });
    expect(res.result.serverInfo).toEqual({ name: "tdk", version: "1.0.0" });
  });
  it("falls back to its newest version for an unknown one", async () => {
    const res = await call({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "1999-01-01" },
    });
    expect(res.result.protocolVersion).toBe("2025-06-18");
  });
  it("sends no reply to notifications", async () => {
    expect(await call({ jsonrpc: "2.0", method: "notifications/initialized" })).toBeNull();
  });
  it("answers ping and lists tools without their handlers", async () => {
    expect((await call({ jsonrpc: "2.0", id: 2, method: "ping" })).result).toEqual({});
    const list = await call({ jsonrpc: "2.0", id: 3, method: "tools/list" });
    expect(list.result.tools.map((t: { name: string }) => t.name)).toEqual(["echo", "boom"]);
    expect(list.result.tools[0].handler).toBeUndefined();
  });
  it("calls a tool and returns text plus structured content", async () => {
    const res = await call({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "echo", arguments: { a: 1 } },
    });
    expect(res.result.isError).toBe(false);
    expect(res.result.structuredContent).toEqual({ got: { a: 1 } });
    expect(JSON.parse(res.result.content[0].text)).toEqual({ got: { a: 1 } });
  });
  it("turns a thrown handler error into an error result, not a protocol error", async () => {
    const res = await call({
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: { name: "boom" },
    });
    expect((res as Partial<Response>).error).toBeUndefined();
    expect(res.result).toMatchObject({ isError: true, content: [{ text: "kaput" }] });
  });
  it("rejects an unknown tool, non-object arguments, and unknown methods", async () => {
    expect(
      (await call({ jsonrpc: "2.0", id: 6, method: "tools/call", params: { name: "nope" } })).error
        .code,
    ).toBe(-32602);
    expect(
      (
        await call({
          jsonrpc: "2.0",
          id: 7,
          method: "tools/call",
          params: { name: "echo", arguments: [1] },
        })
      ).error.code,
    ).toBe(-32602);
    expect((await call({ jsonrpc: "2.0", id: 8, method: "resources/list" })).error.code).toBe(
      -32601,
    );
  });
  it("reports malformed input without crashing", async () => {
    expect(JSON.parse((await server.handleLine("{nope")) as string).error.code).toBe(-32700);
    expect(JSON.parse((await server.handleLine("[1]")) as string).error.code).toBe(-32600);
    expect(await server.handleLine("   ")).toBeNull();
    expect((await call({ id: 9, method: "ping" })).error.code).toBe(-32600);
  });
});
