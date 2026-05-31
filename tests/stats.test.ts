import { describe, test, expect } from "bun:test"
import {
  emptySessionSnapshot,
  aggregateSessionFromMessages,
  cacheHitRatio,
  combinedCacheHitRatio,
  subAgentHasStats,
  sidebarShouldShow,
  computePerCallHitTrend,
  perMessageHitPercent,
  toSubAgentSummary,
  aggregateSubAgents,
} from "../src/stats.ts"
import type { SubAgentSummary } from "../src/types.ts"

describe("aggregateSessionFromMessages", () => {
  test("empty input", () => {
    expect(aggregateSessionFromMessages([])).toEqual(emptySessionSnapshot())
  })

  test("accumulates assistant fields", () => {
    const snap = aggregateSessionFromMessages([
      {
        role: "assistant",
        modelID: "deepseek-v4-flash",
        cost: 0.005,
        tokens: { input: 100, output: 50, cache: { read: 500 } },
      },
    ])
    expect(snap.cost).toBe(0.005)
    expect(snap.cacheRead).toBe(500)
  })
})

describe("cacheHitRatio", () => {
  test("computes ratio", () => {
    expect(cacheHitRatio(800, 200)).toBe(0.8)
  })
})

describe("combinedCacheHitRatio", () => {
  test("merges sub-agents", () => {
    const main = { ...emptySessionSnapshot(), cacheRead: 800, input: 200 }
    const subs: SubAgentSummary[] = [
      { id: "c1", cost: 0, input: 100, output: 0, reasoning: 0, cacheRead: 400, cacheWrite: 0 },
    ]
    expect(combinedCacheHitRatio(main, subs)).toBe(0.8)
  })
})

describe("sidebarShouldShow", () => {
  test("visible with subs only", () => {
    expect(
      sidebarShouldShow(emptySessionSnapshot(), [
        { id: "x", cost: 0, input: 5, output: 0, reasoning: 0, cacheRead: 0, cacheWrite: 0 },
      ]),
    ).toBe(true)
  })

  test("visible when main has stats", () => {
    expect(
      sidebarShouldShow({ ...emptySessionSnapshot(), cacheRead: 100 }, []),
    ).toBe(true)
  })

  test("hidden when no main stats and no subs", () => {
    expect(sidebarShouldShow(emptySessionSnapshot(), [])).toBe(false)
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

describe("computePerCallHitTrend", () => {
  test("trend between last two assistant turns", () => {
    const r = computePerCallHitTrend([
      { role: "assistant", tokens: { input: 100, cache: { read: 0 } } },
      { role: "assistant", tokens: { input: 10, cache: { read: 90 } } },
    ])
    expect(r.hitPercent).toBeCloseTo(90, 5)
    expect(r.trendPercent).toBeCloseTo(90, 5)
    expect(r.hasTrend).toBe(true)
  })
})

describe("aggregateSubAgents", () => {
  test("sums child sessions", () => {
    const total = aggregateSubAgents([
      { id: "a", cost: 1, input: 10, output: 2, reasoning: 0, cacheRead: 100, cacheWrite: 5 },
      { id: "b", cost: 2, input: 20, output: 3, reasoning: 1, cacheRead: 200, cacheWrite: 0 },
    ])
    expect(total.input).toBe(30)
    expect(total.cacheRead).toBe(300)
    expect(total.cacheWrite).toBe(5)
    expect(total.cost).toBe(3)
  })
})

describe("toSubAgentSummary", () => {
  test("maps snapshot fields", () => {
    const s = toSubAgentSummary("cid", {
      ...emptySessionSnapshot(),
      input: 1,
      cacheWrite: 2,
    })
    expect(s.id).toBe("cid")
    expect(s.cacheWrite).toBe(2)
  })
})

describe("subAgentHasStats", () => {
  test("detects activity", () => {
    expect(subAgentHasStats({ ...emptySessionSnapshot(), cacheRead: 1 })).toBe(true)
    expect(subAgentHasStats({ ...emptySessionSnapshot(), output: 10 })).toBe(true)
    expect(subAgentHasStats(emptySessionSnapshot())).toBe(false)
  })
})
