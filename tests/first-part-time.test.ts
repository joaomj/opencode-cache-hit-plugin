import { describe, expect, test } from "bun:test"
import { createFirstPartTimeTracker, earliestPartStart, visibleTextTimingFromParts } from "../src/first-part-time.ts"

describe("first-part-time", () => {
  test("keeps the first and last visible text timestamps", () => {
    const tracker = createFirstPartTimeTracker()
    expect(tracker.handlePart("m1", "text", 1500)).toBe(true)
    expect(tracker.handlePart("m1", "reasoning", 1200)).toBe(false)
    expect(tracker.handlePart("m1", "text", 1700, 2200)).toBe(true)
    expect(tracker.get().get("m1")).toEqual({ start: 1500, end: 2200 })
  })

  test("ignores non-generated parts", () => {
    const tracker = createFirstPartTimeTracker()
    expect(tracker.handlePart("m1", "tool", 1500)).toBe(false)
    expect(tracker.get().size).toBe(0)
  })

  test("recovers visible text timing from state", () => {
    expect(
      earliestPartStart(
        [
          { type: "text", time: { start: 2000, end: 3000 } },
          { type: "reasoning", time: { start: 1500 } },
          { type: "tool", time: { start: 1200 } },
        ],
        1000,
      ),
    ).toBe(2000)
  })

  test("ignores synthetic and ignored text", () => {
    expect(
      visibleTextTimingFromParts(
        [
          { type: "text", synthetic: true, time: { start: 1100, end: 2100 } },
          { type: "text", ignored: true, time: { start: 1200, end: 2200 } },
        ],
        1000,
      ),
    ).toBeUndefined()
  })
})
