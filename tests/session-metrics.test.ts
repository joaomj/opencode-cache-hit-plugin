import { describe, expect, test } from "bun:test"
import {
  aggregateSessionSpeed,
  computeSessionSpeed,
  loadSessionSpeed,
  speedContribution,
} from "../src/session-metrics.ts"

describe("session speed metrics", () => {
  test("uses total generated tokens divided by total generation time", () => {
    const totals = aggregateSessionSpeed([
      { role: "assistant", id: "m1", tokens: { output: 100 }, time: { created: 0, completed: 1000 } },
      { role: "assistant", id: "m2", tokens: { output: 200, reasoning: 100 }, time: { created: 0, completed: 2000 } },
    ], new Map([["m1", 100], ["m2", 500]]))
    expect(totals).toEqual({ tokens: 400, durationMs: 2400 })
    expect(computeSessionSpeed(totals)).toBeCloseTo(166.667, 2)
  })

  test("ignores calls without first-part timing, summaries, incomplete calls, and short calls", () => {
    const messages = [
      { role: "assistant", summary: true, tokens: { output: 100 }, time: { created: 0, completed: 1000 } },
      { role: "assistant", tokens: { output: 100 }, time: { created: 0 } },
      { role: "assistant", tokens: { output: 100 }, time: { created: 0, completed: 499 } },
      { role: "assistant", id: "no-first-part", tokens: { output: 100 }, time: { created: 0, completed: 1000 } },
    ]
    expect(speedContribution(messages[0])).toBeUndefined()
    expect(aggregateSessionSpeed(messages)).toEqual({ tokens: 0, durationMs: 0 })
  })

  test("folds history and releases message-shaped data at the boundary", async () => {
    const result = await loadSessionSpeed({
      client: {
        messages: async () => [
          { info: { role: "assistant", id: "m1", tokens: { output: 50 }, time: { created: 0, completed: 1000 } } },
          { info: { role: "user", id: "u1" } },
        ],
      },
      sessionId: "session-1",
      directory: "/tmp",
      fallback: { tokens: 1, durationMs: 1 },
      part: (messageID) => messageID === "m1" ? [{ type: "text", time: { start: 200 } }] : undefined,
    })
    expect(result.speed).toEqual({ tokens: 50, durationMs: 800 })
    expect(result.messageKeys).toEqual(["m1"])
    expect(result.complete).toBe(true)
  })

  test("falls back when the history request fails", async () => {
    const fallback = { tokens: 12, durationMs: 600 }
    const result = await loadSessionSpeed({
      client: { messages: async () => { throw new Error("offline") } },
      sessionId: "session-1",
      directory: "/tmp",
      fallback,
    })
    expect(result.speed).toEqual(fallback)
    expect(result.complete).toBe(false)
  })
})
