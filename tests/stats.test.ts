import { describe, test, expect } from "bun:test"
import {
  emptySessionSnapshot,
  aggregateFromSessionObject,
  aggregateSessionFromMessages,
  cacheHitRatio,
  perMessageHitPercent,
} from "../src/stats.ts"

describe("aggregateFromSessionObject", () => {
  test("empty session returns zero snapshot", () => {
    expect(aggregateFromSessionObject({})).toEqual(emptySessionSnapshot())
  })

  test("reads aggregate fields from session object", () => {
    const snap = aggregateFromSessionObject({
      tokens: {
        input: 1000,
        output: 500,
        reasoning: 100,
        cache: { read: 8000, write: 2000 },
      },
    })
    expect(snap.input).toBe(1000)
    expect(snap.output).toBe(500)
    expect(snap.reasoning).toBe(100)
    expect(snap.cacheRead).toBe(8000)
    expect(snap.cacheWrite).toBe(2000)
  })

  test("handles missing tokens", () => {
    const snap = aggregateFromSessionObject({})
    expect(snap.input).toBe(0)
    expect(snap.cacheRead).toBe(0)
  })
})

describe("aggregateSessionFromMessages", () => {
  test("empty input", () => {
    expect(aggregateSessionFromMessages([])).toEqual(emptySessionSnapshot())
  })

  test("accumulates assistant fields", () => {
    const snap = aggregateSessionFromMessages([
      {
        role: "assistant",
        tokens: { input: 100, output: 50, cache: { read: 500 } },
      },
    ])
    expect(snap.cacheRead).toBe(500)
  })
})

describe("cacheHitRatio", () => {
  test("computes ratio", () => {
    expect(cacheHitRatio(800, 200)).toBe(0.8)
  })
})

describe("perMessageHitPercent", () => {
  test("null for summary or empty denom", () => {
    expect(perMessageHitPercent({ role: "assistant", summary: true })).toBeNull()
    expect(perMessageHitPercent({ role: "assistant", tokens: { input: 0 } })).toBeNull()
  })

  test("matches ratio", () => {
    expect(
      perMessageHitPercent({
        role: "assistant",
        tokens: { input: 10, cache: { read: 90 } },
      }),
    ).toBeCloseTo(90, 5)
  })
})
