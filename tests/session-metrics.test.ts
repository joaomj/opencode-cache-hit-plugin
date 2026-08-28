import { describe, expect, test } from "bun:test"
import {
  aggregateSessionSpeed,
  computeSessionSpeed,
  lastCompletedTurnSpeed,
  loadSessionSpeed,
  speedContribution,
} from "../src/session-metrics.ts"

describe("session speed metrics", () => {
  test("uses output tokens minus the first token divided by visible text time", () => {
    const totals = aggregateSessionSpeed([
      { role: "assistant", id: "m1", finish: "stop", tokens: { output: 100 }, time: { created: 0, completed: 5000 } },
      { role: "assistant", id: "m2", finish: "length", tokens: { output: 200, reasoning: 100 }, time: { created: 0, completed: 5000 } },
    ], new Map([
      ["m1", { start: 100, end: 1000 }],
      ["m2", { start: 500, end: 2000 }],
    ]))
    expect(totals).toEqual({ tokens: 298, durationMs: 2400 })
    expect(computeSessionSpeed(totals)).toBeCloseTo(124.167, 2)
  })

  test("ignores calls without visible timing, summaries, incomplete calls, and short calls", () => {
    const messages = [
      { role: "assistant", summary: true, finish: "stop", tokens: { output: 100 }, time: { created: 0, completed: 1000 } },
      { role: "assistant", tokens: { output: 100 }, time: { created: 0 } },
      { role: "assistant", id: "short", finish: "stop", tokens: { output: 100 }, time: { created: 0, completed: 499 } },
      { role: "assistant", id: "no-text-end", finish: "stop", tokens: { output: 100 }, time: { created: 0, completed: 1000 } },
      { role: "assistant", id: "one-token", finish: "stop", tokens: { output: 1 }, time: { created: 0, completed: 1000 } },
    ]
    expect(speedContribution(messages[0])).toBeUndefined()
    expect(aggregateSessionSpeed(messages, new Map([
      ["short", { start: 100, end: 349 }],
      ["one-token", { start: 100, end: 500 }],
    ]))).toEqual({ tokens: 0, durationMs: 0 })
  })

  test("returns the last completed turn instead of the active turn", () => {
    const messages = [
      { role: "user", id: "u1" },
      { role: "assistant", id: "a1", finish: "stop", tokens: { output: 101 }, time: { created: 0 } },
      { role: "user", id: "u2" },
      { role: "assistant", id: "a2", finish: "stop", tokens: { output: 51 }, time: { created: 0 } },
      { role: "user", id: "u3" },
      { role: "assistant", id: "a3", tokens: { output: 999 }, time: { created: 0 } },
    ]
    const timing = new Map([
      ["a1", { start: 100, end: 1100 }],
      ["a2", { start: 2000, end: 2500 }],
      ["a3", { start: 3000, end: 9000 }],
    ])
    expect(lastCompletedTurnSpeed(messages, timing)).toEqual({ tokens: 50, durationMs: 500 })
  })

  test("aggregates all eligible calls in one completed turn", () => {
    const messages = [
      { role: "user", id: "u1" },
      { role: "assistant", id: "a1", finish: "stop", tokens: { output: 101 }, time: { created: 0 } },
      { role: "assistant", id: "a2", finish: "stop", tokens: { output: 51 }, time: { created: 0 } },
    ]
    const timing = new Map([
      ["a1", { start: 100, end: 1100 }],
      ["a2", { start: 2000, end: 2500 }],
    ])
    expect(lastCompletedTurnSpeed(messages, timing)).toEqual({ tokens: 150, durationMs: 1500 })
  })

  test("folds history and releases message-shaped data at the boundary", async () => {
    const result = await loadSessionSpeed({
      client: {
        messages: async () => [
          { info: { role: "assistant", id: "m1", finish: "stop", tokens: { output: 50 }, time: { created: 0, completed: 1000 } } },
          { info: { role: "user", id: "u1" } },
        ],
      },
      sessionId: "session-1",
      directory: "/tmp",
      fallback: { tokens: 1, durationMs: 1 },
       part: (messageID) => messageID === "m1" ? [{ type: "text", time: { start: 200, end: 1000 } }] : undefined,
    })
    expect(result.speed).toEqual({ tokens: 49, durationMs: 800 })
    expect(result.lastTurn).toEqual({ tokens: 49, durationMs: 800 })
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
