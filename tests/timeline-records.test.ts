import { describe, test, expect } from "bun:test"
import {
  buildCallRecords,
  messageKeyFor,
  mergeAndSortRecords,
} from "../src/timeline/records.ts"

describe("messageKeyFor", () => {
  test("prefers id", () => {
    expect(
      messageKeyFor({ role: "assistant", id: "m1", time: { created: 1 } }, "s"),
    ).toBe("s:m1")
  })

  test("falls back to created and model", () => {
    expect(
      messageKeyFor(
        { role: "assistant", modelID: "gpt", time: { created: 1000 } },
        "s",
      ),
    ).toBe("s:1000:gpt")
  })
})

describe("buildCallRecords", () => {
  test("skips non-assistant", () => {
    expect(buildCallRecords("s", "s", "main", [{ role: "user" }])).toEqual([])
  })

  test("marks summary and hit percent", () => {
    const rows = buildCallRecords("s", "s", "main", [
      {
        role: "assistant",
        summary: true,
        time: { created: 1, completed: 2 },
        tokens: { input: 10, cache: { read: 90 } },
      },
      {
        role: "assistant",
        time: { created: 3, completed: 4 },
        tokens: { input: 100, cache: { read: 900 } },
        cost: 0.01,
      },
    ])
    expect(rows).toHaveLength(2)
    expect(rows[0].skippedForHit).toBe(true)
    expect(rows[0].hitPercent).toBeNull()
    expect(rows[1].hitPercent).toBeCloseTo(90, 5)
    expect(rows[1].isComplete).toBe(true)
  })

  test("omits summary when logSummaryMessages false", () => {
    const rows = buildCallRecords("s", "s", "main", [
      { role: "assistant", summary: true, time: { created: 1 } },
      { role: "assistant", time: { created: 2, completed: 3 }, tokens: { input: 1 } },
    ], { logSummaryMessages: false })
    expect(rows).toHaveLength(1)
  })
})

describe("mergeAndSortRecords", () => {
  test("sorts by completed then created", () => {
    const sorted = mergeAndSortRecords([
      [
        {
          schema: 1,
          recordedAt: "2025-01-01T00:00:00.000Z",
          sessionId: "c",
          rootSessionId: "r",
          scope: "child",
          messageKey: "c:2",
          modelId: "",
          created: "2025-01-01T00:00:05.000Z",
          completedAt: "2025-01-01T00:00:10.000Z",
          isComplete: true,
          input: 0,
          output: 0,
          reasoning: 0,
          cacheRead: 0,
          cacheWrite: 0,
          cost: 0,
          hitPercent: null,
          skippedForHit: false,
        },
      ],
      [
        {
          schema: 1,
          recordedAt: "2025-01-01T00:00:00.000Z",
          sessionId: "r",
          rootSessionId: "r",
          scope: "main",
          messageKey: "r:1",
          modelId: "",
          created: "2025-01-01T00:00:01.000Z",
          completedAt: "2025-01-01T00:00:03.000Z",
          isComplete: true,
          input: 0,
          output: 0,
          reasoning: 0,
          cacheRead: 0,
          cacheWrite: 0,
          cost: 0,
          hitPercent: null,
          skippedForHit: false,
        },
      ],
    ])
    expect(sorted[0].messageKey).toBe("r:1")
    expect(sorted[1].messageKey).toBe("c:2")
  })
})
