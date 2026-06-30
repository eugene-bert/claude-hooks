import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync, mkdirSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { formatToolCall, basename, extractToolCalls, extractLastAssistantText, getSessionContext } from "./notify.js";

// ── basename ──────────────────────────────────────────────────────────────────

describe("basename", () => {
  test("extracts filename from path", () => {
    assert.equal(basename("/foo/bar/baz.ts"), "baz.ts");
  });
  test("returns input when no slash", () => {
    assert.equal(basename("file.ts"), "file.ts");
  });
  test("handles empty string", () => {
    assert.equal(basename(""), "");
  });
});

// ── formatToolCall ────────────────────────────────────────────────────────────

describe("formatToolCall", () => {
  test("Bash", () => {
    const r = formatToolCall({ type: "tool_use", name: "Bash", input: { command: "ls -la" } });
    assert.equal(r, "Bash: ls -la");
  });

  test("Bash truncates at 60 chars", () => {
    const long = "a".repeat(80);
    const r = formatToolCall({ type: "tool_use", name: "Bash", input: { command: long } });
    assert.equal(r.length, "Bash: ".length + 60);
  });

  test("Edit", () => {
    const r = formatToolCall({ type: "tool_use", name: "Edit", input: { file_path: "/foo/bar.ts" } });
    assert.equal(r, "Edit: bar.ts");
  });

  test("Write", () => {
    const r = formatToolCall({ type: "tool_use", name: "Write", input: { file_path: "/foo/baz.ts" } });
    assert.equal(r, "Write: baz.ts");
  });

  test("Read", () => {
    const r = formatToolCall({ type: "tool_use", name: "Read", input: { file_path: "/foo/qux.ts" } });
    assert.equal(r, "Read: qux.ts");
  });

  test("WebFetch", () => {
    const r = formatToolCall({ type: "tool_use", name: "WebFetch", input: { url: "https://example.com" } });
    assert.equal(r, "Fetch: https://example.com");
  });

  test("WebSearch", () => {
    const r = formatToolCall({ type: "tool_use", name: "WebSearch", input: { query: "node test" } });
    assert.equal(r, "Search: node test");
  });

  test("mcp__ tool", () => {
    const r = formatToolCall({ type: "tool_use", name: "mcp__github__get_pr", input: {} });
    assert.equal(r, "github: get_pr");
  });

  test("mcp__ tool with url", () => {
    const r = formatToolCall({ type: "tool_use", name: "mcp__fetch__get", input: { url: "https://api.example.com" } });
    assert.equal(r, "fetch: get https://api.example.com");
  });

  test("unknown tool returns name", () => {
    const r = formatToolCall({ type: "tool_use", name: "UnknownTool", input: {} });
    assert.equal(r, "UnknownTool");
  });

  test("missing input defaults gracefully", () => {
    const r = formatToolCall({ type: "tool_use", name: "Bash" });
    assert.equal(r, "Bash: ");
  });
});

// ── extractToolCalls ──────────────────────────────────────────────────────────

describe("extractToolCalls", () => {
  const tmp = join(tmpdir(), `claude-hooks-test-${process.pid}`);
  mkdirSync(tmp, { recursive: true });

  test("returns empty for nonexistent file", () => {
    assert.deepEqual(extractToolCalls("/nonexistent/path.jsonl"), []);
  });

  test("extracts tool calls from transcript", () => {
    const path = join(tmp, "transcript.jsonl");
    const lines = [
      JSON.stringify({ message: { role: "user", content: "do something" } }),
      JSON.stringify({ message: { role: "assistant", content: [
        { type: "tool_use", name: "Bash", input: { command: "echo hello" } },
        { type: "tool_use", name: "Read", input: { file_path: "/foo/bar.ts" } },
      ]}}),
    ];
    writeFileSync(path, lines.join("\n"));
    const result = extractToolCalls(path);
    assert.deepEqual(result, ["Bash: echo hello", "Read: bar.ts"]);
  });

  test("ignores non-assistant messages", () => {
    const path = join(tmp, "user-only.jsonl");
    writeFileSync(path, JSON.stringify({ message: { role: "user", content: [
      { type: "tool_use", name: "Bash", input: { command: "should not appear" } },
    ]}}));
    assert.deepEqual(extractToolCalls(path), []);
  });

  test("ignores non-tool_use blocks", () => {
    const path = join(tmp, "text-block.jsonl");
    writeFileSync(path, JSON.stringify({ message: { role: "assistant", content: [
      { type: "text", text: "Here is the result" },
    ]}}));
    assert.deepEqual(extractToolCalls(path), []);
  });

  test("returns at most 10 tool calls", () => {
    const path = join(tmp, "many-calls.jsonl");
    const blocks = Array.from({ length: 15 }, (_, i) => ({
      type: "tool_use", name: "Bash", input: { command: `cmd${i}` },
    }));
    writeFileSync(path, JSON.stringify({ message: { role: "assistant", content: blocks } }));
    const result = extractToolCalls(path);
    assert.equal(result.length, 10);
    assert.equal(result[0], "Bash: cmd5"); // last 10
  });

  test("skips malformed JSON lines", () => {
    const path = join(tmp, "malformed.jsonl");
    const lines = [
      "not json at all {{{",
      JSON.stringify({ message: { role: "assistant", content: [
        { type: "tool_use", name: "Write", input: { file_path: "/a/b.ts" } },
      ]}}),
    ];
    writeFileSync(path, lines.join("\n"));
    assert.deepEqual(extractToolCalls(path), ["Write: b.ts"]);
  });

  // cleanup
  test("cleanup", () => { rmSync(tmp, { recursive: true, force: true }); });
});

// ── extractLastAssistantText ──────────────────────────────────────────────────

describe("extractLastAssistantText", () => {
  const tmp = join(tmpdir(), `claude-hooks-last-text-${process.pid}`);
  mkdirSync(tmp, { recursive: true });

  test("returns empty for nonexistent file", () => {
    assert.equal(extractLastAssistantText("/nonexistent.jsonl"), "");
  });

  test("extracts last assistant text block", () => {
    const path = join(tmp, "text.jsonl");
    const lines = [
      JSON.stringify({ message: { role: "assistant", content: [
        { type: "text", text: "First message" },
      ]}}),
      JSON.stringify({ message: { role: "user", content: "ok" } }),
      JSON.stringify({ message: { role: "assistant", content: [
        { type: "tool_use", name: "Bash", input: { command: "ls" } },
        { type: "text", text: "Here is the result of the operation." },
      ]}}),
    ];
    writeFileSync(path, lines.join("\n"));
    assert.equal(extractLastAssistantText(path), "Here is the result of the operation.");
  });

  test("skips entries with no text block", () => {
    const path = join(tmp, "no-text.jsonl");
    const lines = [
      JSON.stringify({ message: { role: "assistant", content: [
        { type: "text", text: "Earlier message" },
      ]}}),
      JSON.stringify({ message: { role: "assistant", content: [
        { type: "tool_use", name: "Bash", input: { command: "ls" } },
      ]}}),
    ];
    writeFileSync(path, lines.join("\n"));
    assert.equal(extractLastAssistantText(path), "Earlier message");
  });

  test("truncates at 500 chars", () => {
    const path = join(tmp, "long-text.jsonl");
    writeFileSync(path, JSON.stringify({ message: { role: "assistant", content: [
      { type: "text", text: "a".repeat(600) },
    ]}}));
    assert.equal(extractLastAssistantText(path).length, 500);
  });

  test("returns empty when no assistant messages", () => {
    const path = join(tmp, "user-only.jsonl");
    writeFileSync(path, JSON.stringify({ message: { role: "user", content: "hello" } }));
    assert.equal(extractLastAssistantText(path), "");
  });

  // cleanup
  test("cleanup", () => { rmSync(tmp, { recursive: true, force: true }); });
});

// ── getSessionContext ─────────────────────────────────────────────────────────

describe("getSessionContext", () => {
  const tmp = join(tmpdir(), `claude-hooks-ctx-test-${process.pid}`);
  mkdirSync(tmp, { recursive: true });

  test("extracts project name from path", () => {
    const dir = join(tmp, "-Users-eugene-projects-personal-myproject");
    mkdirSync(dir, { recursive: true });
    const path = join(dir, "session.jsonl");
    writeFileSync(path, "");
    const ctx = getSessionContext(path);
    assert.equal(ctx.project, "myproject");
  });

  test("computes duration in seconds", () => {
    const dir = join(tmp, "-Users-eugene-projects-duration");
    mkdirSync(dir, { recursive: true });
    const path = join(dir, "session.jsonl");
    const now = Date.now();
    const lines = [
      JSON.stringify({ timestamp: now - 30_000 }),
      JSON.stringify({ timestamp: now }),
    ];
    writeFileSync(path, lines.join("\n"));
    const ctx = getSessionContext(path);
    assert.equal(ctx.duration, "30s");
  });

  test("computes duration in minutes", () => {
    const dir = join(tmp, "-Users-eugene-projects-duration-min");
    mkdirSync(dir, { recursive: true });
    const path = join(dir, "session.jsonl");
    const now = Date.now();
    const lines = [
      JSON.stringify({ timestamp: now - 3 * 60_000 }),
      JSON.stringify({ timestamp: now }),
    ];
    writeFileSync(path, lines.join("\n"));
    const ctx = getSessionContext(path);
    assert.equal(ctx.duration, "3m");
  });

  test("returns empty duration for missing timestamps", () => {
    const dir = join(tmp, "-Users-eugene-projects-no-ts");
    mkdirSync(dir, { recursive: true });
    const path = join(dir, "session.jsonl");
    writeFileSync(path, JSON.stringify({ message: "no timestamp" }));
    const ctx = getSessionContext(path);
    assert.equal(ctx.duration, "");
  });

  // cleanup
  test("cleanup", () => { rmSync(tmp, { recursive: true, force: true }); });
});
