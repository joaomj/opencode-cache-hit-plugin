import { describe, expect, test } from "bun:test"
import {
  computeTokenSpeed,
  computeAvgTokenSpeed,
  formatTokenSpeed,
  estimateStreamingSpeed,
} from "../src/token-speed.ts"

describe("computeTokenSpeed", () => {
  test("returns 0 for duration < 500ms", () => {
    expect(computeTokenSpeed(100, 50, 400)).toBe(0)
  })

  test("computes speed for duration >= 500ms", () => {
    expect(computeTokenSpeed(100, 50, 500)).toBe(300)
  })

  test("computes speed for valid duration", () => {
    expect(computeTokenSpeed(100, 0, 1000)).toBe(100)
  })

  test("includes reasoning tokens", () => {
    expect(computeTokenSpeed(100, 50, 1000)).toBe(150)
  })

  test("handles zero tokens", () => {
    expect(computeTokenSpeed(0, 0, 1000)).toBe(0)
  })
})

describe("computeAvgTokenSpeed", () => {
  test("returns 0 for empty messages", () => {
    expect(computeAvgTokenSpeed([])).toBe(0)
  })

  test("skips messages without time.completed", () => {
    const msgs = [{ tokens: { output: 100 }, time: { created: 0 } }]
    expect(computeAvgTokenSpeed(msgs)).toBe(0)
  })

  test("skips summary messages", () => {
    const msgs = [
      {
        summary: true,
        tokens: { output: 100 },
        time: { created: 0, completed: 1000 },
      },
    ]
    expect(computeAvgTokenSpeed(msgs)).toBe(0)
  })

  test("skips messages with duration < 500ms", () => {
    const msgs = [
      {
        tokens: { output: 100 },
        time: { created: 0, completed: 400 },
      },
    ]
    expect(computeAvgTokenSpeed(msgs)).toBe(0)
  })

  test("skips messages with zero tokens", () => {
    const msgs = [
      {
        tokens: { output: 0, reasoning: 0 },
        time: { created: 0, completed: 1000 },
      },
    ]
    expect(computeAvgTokenSpeed(msgs)).toBe(0)
  })

  test("computes average for valid messages", () => {
    const msgs = [
      {
        tokens: { output: 100, reasoning: 0 },
        time: { created: 0, completed: 1000 },
      },
      {
        tokens: { output: 200, reasoning: 0 },
        time: { created: 0, completed: 1000 },
      },
    ]
    expect(computeAvgTokenSpeed(msgs)).toBe(150)
  })

  test("includes reasoning tokens", () => {
    const msgs = [
      {
        tokens: { output: 100, reasoning: 50 },
        time: { created: 0, completed: 1000 },
      },
    ]
    expect(computeAvgTokenSpeed(msgs)).toBe(150)
  })
})

describe("formatTokenSpeed", () => {
  test("formats speed < 1 as '<1 tok/s'", () => {
    expect(formatTokenSpeed(0.5)).toBe("<1 tok/s")
  })

  test("formats speed >= 1 rounded", () => {
    expect(formatTokenSpeed(42.7)).toBe("43 tok/s")
  })

  test("formats zero as '<1 tok/s'", () => {
    expect(formatTokenSpeed(0)).toBe("<1 tok/s")
  })
})

describe("estimateStreamingSpeed", () => {
  test("returns 0 for empty text", () => {
    expect(estimateStreamingSpeed("", 0, 1000)).toBe(0)
  })

  test("returns 0 for elapsed < 500ms", () => {
    expect(estimateStreamingSpeed("hello", 0, 400)).toBe(0)
  })

  test("estimates speed based on char count", () => {
    const result = estimateStreamingSpeed("abcdefgh", 0, 1000)
    expect(result).toBe(2)
  })

  test("uses Math.max(1, ...) for estimation", () => {
    const result = estimateStreamingSpeed("ab", 0, 1000)
    expect(result).toBe(1)
  })
})
