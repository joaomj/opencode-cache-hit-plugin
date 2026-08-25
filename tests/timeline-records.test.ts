import { describe, test, expect } from "bun:test"
import { messageKeyFor, assistantMessageToRecord } from "../src/timeline/records.ts"

describe("messageKeyFor", () => {
  test("prefers id", () => {
    expect(messageKeyFor({ role: "assistant", id: "m1", time: { created: 1 } }, "s")).toBe("s:m1")
  })

  test("falls back to the session and creation time", () => {
    expect(messageKeyFor({ role: "assistant", time: { created: 1000 } }, "s")).toBe("s:1000")
  })
})

describe("assistantMessageToRecord", () => {
  test("records session metrics and completed-call speed", () => {
    const rec = assistantMessageToRecord(
      {
        role: "assistant",
        id: "m1",
        time: { created: 1000, completed: 3000 },
        tokens: { input: 10, output: 20, reasoning: 30, cache: { read: 90, write: 2 } },
        cost: 0.25,
      },
      "s1",
      5000,
      undefined,
      1500,
    )
    expect(rec).not.toBeNull()
    expect(rec!.sessionId).toBe("s1")
    expect(rec!.input).toBe(10)
    expect(rec!.output).toBe(20)
    expect(rec!.reasoning).toBe(30)
    expect(rec!.cacheRead).toBe(90)
    expect(rec!.cacheWrite).toBe(2)
    expect(rec!.cost).toBe(0.25)
    expect(rec!.tps).toBeCloseTo(33.333, 2)
  })

  test("preserves finish reason", () => {
    const rec = assistantMessageToRecord(
      { role: "assistant", id: "m1", finish: "stop", time: { created: 1000, completed: 3000 } },
      "s1",
      5000,
    )
    expect(rec!.finish).toBe("stop")
  })

  test("includes tool durations when provided", () => {
    const toolDurations = [{ tool: "bash", summary: "list files", durationMs: 150 }]
    const rec = assistantMessageToRecord(
      { role: "assistant", id: "m1", time: { created: 1000, completed: 3000 } },
      "s1",
      5000,
      toolDurations,
    )
    expect(rec!.toolDurations).toEqual(toolDurations)
  })

  test("does not calculate speed without output tokens", () => {
    const rec = assistantMessageToRecord(
      { role: "assistant", id: "m1", time: { created: 1000, completed: 3000 } },
      "s1",
      5000,
    )
    expect(rec!.tps).toBeUndefined()
  })

  test("does not calculate speed without first-part timing", () => {
    const rec = assistantMessageToRecord(
      { role: "assistant", id: "m1", time: { created: 1000, completed: 3000 }, tokens: { output: 20 } },
      "s1",
      5000,
    )
    expect(rec!.tps).toBeUndefined()
  })
})
