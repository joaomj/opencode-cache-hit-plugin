import { describe, expect, test } from "bun:test"
import { createFirstPartTimeTracker, earliestPartStart } from "../src/first-part-time.ts"

describe("first-part-time", () => {
  test("keeps the earliest generated part", () => {
    const tracker = createFirstPartTimeTracker()
    expect(tracker.handlePart("m1", "text", 1500)).toBe(true)
    expect(tracker.handlePart("m1", "reasoning", 1200)).toBe(true)
    expect(tracker.get().get("m1")).toBe(1200)
  })

  test("ignores non-generated parts", () => {
    const tracker = createFirstPartTimeTracker()
    expect(tracker.handlePart("m1", "tool", 1500)).toBe(false)
    expect(tracker.get().size).toBe(0)
  })

  test("recovers the earliest valid part from state", () => {
    expect(
      earliestPartStart(
        [
          { type: "text", time: { start: 2000 } },
          { type: "reasoning", time: { start: 1500 } },
          { type: "tool", time: { start: 1200 } },
        ],
        1000,
      ),
    ).toBe(1500)
  })
})
