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
      { role: "assistant", tokens: { output: 100 }, time: { created: 0, completed: 1000 } },
      { role: "assistant", tokens: { output: 200, reasoning: 100 }, time: { created: 0, completed: 2000 } },
    ])
    expect(totals).toEqual({ tokens: 400, durationMs: 3000 })
    expect(computeSessionSpeed(totals)).toBeCloseTo(133.333, 2)
  })

  test("ignores summaries, incomplete calls, and short calls", () => {
    const messages = [
      { role: "assistant", summary: true, tokens: { output: 100 }, time: { created: 0, completed: 1000 } },
      { role: "assistant", tokens: { output: 100 }, time: { created: 0 } },
      { role: "assistant", tokens: { output: 100 }, time: { created: 0, completed: 499 } },
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
    })
    expect(result.speed).toEqual({ tokens: 50, durationMs: 1000 })
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
