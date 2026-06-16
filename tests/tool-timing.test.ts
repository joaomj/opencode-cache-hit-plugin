import { describe, test, expect } from "bun:test"
import { createToolTimingTracker } from "../src/tool-timing.ts"

describe("createToolTimingTracker", () => {
  test("completed without prior running uses state.time.start", () => {
    const t = createToolTimingTracker()
    t.handleToolPart("msg1", {
      type: "tool",
      tool: "bash",
      callID: "call_1",
      state: { status: "completed", time: { start: 1000, end: 1500 } },
    })
    const durations = t.getDurations("msg1")
    expect(durations).toBeDefined()
    expect(durations![0].durationMs).toBe(500)
  })

  test("omits tool when completed without any start time", () => {
    const t = createToolTimingTracker()
    t.handleToolPart("msg1", {
      type: "tool",
      tool: "bash",
      callID: "call_1",
      state: { status: "completed" },
    })
    expect(t.getDurations("msg1")).toBeUndefined()
  })

  test("captures running-to-completed duration", () => {
    const t = createToolTimingTracker()
    t.handleToolPart("msg1", {
      type: "tool",
      tool: "bash",
      callID: "call_1",
      state: { status: "running", time: { start: 1000 } },
    })
    t.handleToolPart("msg1", {
      type: "tool",
      tool: "bash",
      callID: "call_1",
      state: { status: "completed", time: { start: 1000, end: 1500 } },
    })
    const durations = t.getDurations("msg1")
    expect(durations).toBeDefined()
    expect(durations!.length).toBe(1)
    expect(durations![0].tool).toBe("bash")
    expect(durations![0].durationMs).toBe(500)
  })

  test("bash summary uses command (truncated)", () => {
    const t = createToolTimingTracker()
    t.handleToolPart("msg1", {
      type: "tool",
      tool: "bash",
      callID: "call_1",
      state: { status: "running", input: { description: "list files", command: "ls -la" }, time: { start: 1000 } },
    })
    t.handleToolPart("msg1", {
      type: "tool",
      tool: "bash",
      callID: "call_1",
      state: { status: "completed", time: { start: 1000, end: 1100 } },
    })
    expect(t.getDurations("msg1")![0].summary).toBe("ls -la")
  })

  test("bash summary truncated to 60 chars", () => {
    const t = createToolTimingTracker()
    const longCmd = "git add " + "a".repeat(60) + " && git commit"
    t.handleToolPart("msg1", {
      type: "tool",
      tool: "bash",
      callID: "call_1",
      state: { status: "running", input: { command: longCmd }, time: { start: 1000 } },
    })
    t.handleToolPart("msg1", {
      type: "tool",
      tool: "bash",
      callID: "call_1",
      state: { status: "completed", time: { start: 1000, end: 1100 } },
    })
    const summary = t.getDurations("msg1")![0].summary!
    expect(summary.length).toBeLessThanOrEqual(60)
    expect(summary).toEndWith("...")
  })

  test("bash summary returns undefined when command is empty", () => {
    const t = createToolTimingTracker()
    t.handleToolPart("msg1", {
      type: "tool",
      tool: "bash",
      callID: "call_1",
      state: { status: "running", input: { description: "no command" }, time: { start: 1000 } },
    })
    t.handleToolPart("msg1", {
      type: "tool",
      tool: "bash",
      callID: "call_1",
      state: { status: "completed", time: { start: 1000, end: 1100 } },
    })
    expect(t.getDurations("msg1")![0].summary).toBeUndefined()
  })

  test("ignores non-string tool input fields", () => {
    const t = createToolTimingTracker()
    t.handleToolPart("msg1", {
      type: "tool",
      tool: "bash",
      callID: "call_1",
      state: {
        status: "running",
        input: { command: { text: "nested" } },
        time: { start: 1000 },
      },
    })
    t.handleToolPart("msg1", {
      type: "tool",
      tool: "bash",
      callID: "call_1",
      state: { status: "completed", time: { start: 1000, end: 1100 } },
    })
    expect(t.getDurations("msg1")![0].summary).toBeUndefined()
  })

  test("read summary returns basename only", () => {
    const t = createToolTimingTracker()
    t.handleToolPart("msg1", {
      type: "tool",
      tool: "read",
      callID: "call_r",
      state: { status: "running", input: { filePath: "/home/user/src/app.ts" }, time: { start: 1000 } },
    })
    t.handleToolPart("msg1", {
      type: "tool",
      tool: "read",
      callID: "call_r",
      state: { status: "completed", time: { start: 1000, end: 1010 } },
    })
    expect(t.getDurations("msg1")![0].summary).toBe("app.ts")
  })

  test("write summary returns basename only", () => {
    const t = createToolTimingTracker()
    t.handleToolPart("msg1", {
      type: "tool",
      tool: "write",
      callID: "call_w",
      state: { status: "running", input: { filePath: "/tmp/output.txt" }, time: { start: 1000 } },
    })
    t.handleToolPart("msg1", {
      type: "tool",
      tool: "write",
      callID: "call_w",
      state: { status: "completed", time: { start: 1000, end: 1010 } },
    })
    expect(t.getDurations("msg1")![0].summary).toBe("output.txt")
  })

  test("edit summary returns basename only", () => {
    const t = createToolTimingTracker()
    t.handleToolPart("msg1", {
      type: "tool",
      tool: "edit",
      callID: "call_e",
      state: { status: "running", input: { filePath: "/Users/me/project/index.ts" }, time: { start: 1000 } },
    })
    t.handleToolPart("msg1", {
      type: "tool",
      tool: "edit",
      callID: "call_e",
      state: { status: "completed", time: { start: 1000, end: 1010 } },
    })
    expect(t.getDurations("msg1")![0].summary).toBe("index.ts")
  })

  test("webfetch invalid URL strips query in fallback", () => {
    const t = createToolTimingTracker()
    t.handleToolPart("msg1", {
      type: "tool",
      tool: "webfetch",
      callID: "call_w",
      state: { status: "running", input: { url: "not-a-valid-url?token=secret" }, time: { start: 1000 } },
    })
    t.handleToolPart("msg1", {
      type: "tool",
      tool: "webfetch",
      callID: "call_w",
      state: { status: "completed", time: { start: 1000, end: 1010 } },
    })
    expect(t.getDurations("msg1")![0].summary).toBe("not-a-valid-url")
  })

  test("webfetch summary returns domain+path without query", () => {
    const t = createToolTimingTracker()
    t.handleToolPart("msg1", {
      type: "tool",
      tool: "webfetch",
      callID: "call_w",
      state: { status: "running", input: { url: "https://example.com/api/data?token=secret&id=123" }, time: { start: 1000 } },
    })
    t.handleToolPart("msg1", {
      type: "tool",
      tool: "webfetch",
      callID: "call_w",
      state: { status: "completed", time: { start: 1000, end: 1010 } },
    })
    expect(t.getDurations("msg1")![0].summary).toBe("example.com/api/data")
  })

  test("grep pattern truncated to 60 chars", () => {
    const t = createToolTimingTracker()
    const longPattern = "secret_" + "x".repeat(70)
    t.handleToolPart("msg1", {
      type: "tool",
      tool: "grep",
      callID: "call_g",
      state: { status: "running", input: { pattern: longPattern }, time: { start: 1000 } },
    })
    t.handleToolPart("msg1", {
      type: "tool",
      tool: "grep",
      callID: "call_g",
      state: { status: "completed", time: { start: 1000, end: 1010 } },
    })
    const summary = t.getDurations("msg1")![0].summary!
    expect(summary.length).toBeLessThanOrEqual(60)
    expect(summary).toEndWith("...")
  })

  test("glob summary returns pattern", () => {
    const t = createToolTimingTracker()
    t.handleToolPart("msg1", {
      type: "tool",
      tool: "glob",
      callID: "call_gl",
      state: { status: "running", input: { pattern: "src/**/*.ts" }, time: { start: 1000 } },
    })
    t.handleToolPart("msg1", {
      type: "tool",
      tool: "glob",
      callID: "call_gl",
      state: { status: "completed", time: { start: 1000, end: 1010 } },
    })
    expect(t.getDurations("msg1")![0].summary).toBe("src/**/*.ts")
  })

  test("websearch summary returns query (truncated)", () => {
    const t = createToolTimingTracker()
    t.handleToolPart("msg1", {
      type: "tool",
      tool: "websearch",
      callID: "call_ws",
      state: { status: "running", input: { query: "how to use bun test framework" }, time: { start: 1000 } },
    })
    t.handleToolPart("msg1", {
      type: "tool",
      tool: "websearch",
      callID: "call_ws",
      state: { status: "completed", time: { start: 1000, end: 1010 } },
    })
    expect(t.getDurations("msg1")![0].summary).toBe("how to use bun test framework")
  })

  test("websearch summary truncated to 60 chars", () => {
    const t = createToolTimingTracker()
    const longQuery = "a".repeat(70)
    t.handleToolPart("msg1", {
      type: "tool",
      tool: "websearch",
      callID: "call_ws",
      state: { status: "running", input: { query: longQuery }, time: { start: 1000 } },
    })
    t.handleToolPart("msg1", {
      type: "tool",
      tool: "websearch",
      callID: "call_ws",
      state: { status: "completed", time: { start: 1000, end: 1010 } },
    })
    const summary = t.getDurations("msg1")![0].summary!
    expect(summary.length).toBeLessThanOrEqual(60)
    expect(summary).toEndWith("...")
  })

  test("lsp_diagnostics summary returns basename", () => {
    const t = createToolTimingTracker()
    t.handleToolPart("msg1", {
      type: "tool",
      tool: "lsp_diagnostics",
      callID: "call_lsp",
      state: { status: "running", input: { filePath: "/project/src/main.ts" }, time: { start: 1000 } },
    })
    t.handleToolPart("msg1", {
      type: "tool",
      tool: "lsp_diagnostics",
      callID: "call_lsp",
      state: { status: "completed", time: { start: 1000, end: 1010 } },
    })
    expect(t.getDurations("msg1")![0].summary).toBe("main.ts")
  })

  test("question summary returns header", () => {
    const t = createToolTimingTracker()
    t.handleToolPart("msg1", {
      type: "tool",
      tool: "question",
      callID: "call_q",
      state: {
        status: "running",
        input: { questions: [{ header: "Choose color", question: "Which color do you prefer?", options: [] }] },
        time: { start: 1000 },
      },
    })
    t.handleToolPart("msg1", {
      type: "tool",
      tool: "question",
      callID: "call_q",
      state: { status: "completed", time: { start: 1000, end: 1010 } },
    })
    expect(t.getDurations("msg1")![0].summary).toBe("Choose color")
  })

  test("question header truncated to 60 chars", () => {
    const t = createToolTimingTracker()
    const longHeader = "H".repeat(70)
    t.handleToolPart("msg1", {
      type: "tool",
      tool: "question",
      callID: "call_q",
      state: {
        status: "running",
        input: { questions: [{ header: longHeader, question: "short?" }] },
        time: { start: 1000 },
      },
    })
    t.handleToolPart("msg1", {
      type: "tool",
      tool: "question",
      callID: "call_q",
      state: { status: "completed", time: { start: 1000, end: 1010 } },
    })
    const summary = t.getDurations("msg1")![0].summary!
    expect(summary.length).toBeLessThanOrEqual(60)
    expect(summary).toEndWith("...")
  })

  test("question summary falls back to question text", () => {
    const t = createToolTimingTracker()
    t.handleToolPart("msg1", {
      type: "tool",
      tool: "question",
      callID: "call_q",
      state: {
        status: "running",
        input: { questions: [{ question: "What is your preferred framework?" }] },
        time: { start: 1000 },
      },
    })
    t.handleToolPart("msg1", {
      type: "tool",
      tool: "question",
      callID: "call_q",
      state: { status: "completed", time: { start: 1000, end: 1010 } },
    })
    expect(t.getDurations("msg1")![0].summary).toBe("What is your preferred framework?")
  })

  test("todowrite summary is undefined", () => {
    const t = createToolTimingTracker()
    t.handleToolPart("msg1", {
      type: "tool",
      tool: "todowrite",
      callID: "call_t",
      state: {
        status: "running",
        input: { todos: [{ content: "Fix bug", status: "pending" }] },
        time: { start: 1000 },
      },
    })
    t.handleToolPart("msg1", {
      type: "tool",
      tool: "todowrite",
      callID: "call_t",
      state: { status: "completed", time: { start: 1000, end: 1010 } },
    })
    expect(t.getDurations("msg1")![0].summary).toBeUndefined()
  })

  test("task description truncated to 60 chars", () => {
    const t = createToolTimingTracker()
    const longDesc = "Find " + "a".repeat(70)
    t.handleToolPart("msg1", {
      type: "tool",
      tool: "task",
      callID: "call_t",
      state: { status: "running", input: { description: longDesc }, time: { start: 1000 } },
    })
    t.handleToolPart("msg1", {
      type: "tool",
      tool: "task",
      callID: "call_t",
      state: { status: "completed", time: { start: 1000, end: 1010 } },
    })
    const summary = t.getDurations("msg1")![0].summary!
    expect(summary.length).toBeLessThanOrEqual(60)
    expect(summary).toEndWith("...")
  })

  test("captures multiple tools per message", () => {
    const t = createToolTimingTracker()
    t.handleToolPart("msg1", {
      type: "tool",
      tool: "read",
      callID: "call_r",
      state: { status: "running", time: { start: 1000 } },
    })
    t.handleToolPart("msg1", {
      type: "tool",
      tool: "read",
      callID: "call_r",
      state: { status: "completed", time: { start: 1000, end: 1020 } },
    })
    t.handleToolPart("msg1", {
      type: "tool",
      tool: "write",
      callID: "call_w",
      state: { status: "running", time: { start: 1020 } },
    })
    t.handleToolPart("msg1", {
      type: "tool",
      tool: "write",
      callID: "call_w",
      state: { status: "completed", time: { start: 1020, end: 1500 } },
    })
    const durations = t.getDurations("msg1")
    expect(durations).toBeDefined()
    expect(durations!.length).toBe(2)
    expect(durations![0].tool).toBe("read")
    expect(durations![0].durationMs).toBe(20)
    expect(durations![1].tool).toBe("write")
    expect(durations![1].durationMs).toBe(480)
  })

  test("excludes running tools from getDurations", () => {
    const t = createToolTimingTracker()
    t.handleToolPart("msg1", {
      type: "tool",
      tool: "bash",
      callID: "call_1",
      state: { status: "running", time: { start: 1000 } },
    })
    expect(t.getDurations("msg1")).toBeUndefined()
  })

  test("uses Date.now() when time fields missing", () => {
    const before = Date.now()
    const t = createToolTimingTracker()
    t.handleToolPart("msg1", {
      type: "tool",
      tool: "bash",
      callID: "call_1",
      state: { status: "running" },
    })
    t.handleToolPart("msg1", {
      type: "tool",
      tool: "bash",
      callID: "call_1",
      state: { status: "completed" },
    })
    const after = Date.now()
    const durations = t.getDurations("msg1")
    expect(durations).toBeDefined()
    expect(durations![0].durationMs!).toBeGreaterThanOrEqual(0)
    expect(durations![0].durationMs!).toBeLessThanOrEqual(after - before + 10)
  })

  test("returns undefined for unknown message", () => {
    const t = createToolTimingTracker()
    expect(t.getDurations("unknown")).toBeUndefined()
  })

  test("handles error state", () => {
    const t = createToolTimingTracker()
    t.handleToolPart("msg1", {
      type: "tool",
      tool: "bash",
      callID: "call_1",
      state: { status: "running", time: { start: 1000 } },
    })
    t.handleToolPart("msg1", {
      type: "tool",
      tool: "bash",
      callID: "call_1",
      state: { status: "error", time: { start: 1000, end: 1800 } },
    })
    const durations = t.getDurations("msg1")
    expect(durations).toBeDefined()
    expect(durations![0].durationMs).toBe(800)
  })

  test("ignores non-tool parts", () => {
    const t = createToolTimingTracker()
    t.handleToolPart("msg1", {
      type: "text",
      state: { status: "completed" },
    })
    expect(t.getDurations("msg1")).toBeUndefined()
  })

  test("ignores parts without callID or tool", () => {
    const t = createToolTimingTracker()
    t.handleToolPart("msg1", {
      type: "tool",
      state: { status: "completed" },
    })
    expect(t.getDurations("msg1")).toBeUndefined()
  })

  test("reset clears state", () => {
    const t = createToolTimingTracker()
    t.handleToolPart("msg1", {
      type: "tool",
      tool: "bash",
      callID: "call_1",
      state: { status: "running", time: { start: 1000 } },
    })
    t.handleToolPart("msg1", {
      type: "tool",
      tool: "bash",
      callID: "call_1",
      state: { status: "completed", time: { start: 1000, end: 1500 } },
    })
    t.reset()
    expect(t.getDurations("msg1")).toBeUndefined()
  })

  test("disposed tracker ignores inputs and clears state", () => {
    const t = createToolTimingTracker()
    t.handleToolPart("msg1", {
      type: "tool",
      tool: "bash",
      callID: "call_1",
      state: { status: "running", time: { start: 1000 } },
    })
    t.handleToolPart("msg1", {
      type: "tool",
      tool: "bash",
      callID: "call_1",
      state: { status: "completed", time: { start: 1000, end: 1500 } },
    })
    t.dispose()
    expect(t.getDurations("msg1")).toBeUndefined()
    t.handleToolPart("msg2", {
      type: "tool",
      tool: "read",
      callID: "call_2",
      state: { status: "running", time: { start: 1000 } },
    })
    expect(t.getDurations("msg2")).toBeUndefined()
  })
})
