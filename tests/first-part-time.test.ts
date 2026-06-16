import { describe, test, expect } from "bun:test"
import {
  createFirstPartTimeTracker,
  earliestPartStart,
} from "../src/first-part-time.ts"

describe("createFirstPartTimeTracker", () => {
  test("records first text part", () => {
    const t = createFirstPartTimeTracker()
    expect(t.handlePart("m1", "text", 1500, "sdk")).toBe(true)
    expect(t.get().get("m1")).toBe(1500)
    expect(t.getSource("m1")).toBe("sdk")
  })

  test("records reasoning parts", () => {
    const t = createFirstPartTimeTracker()
    expect(t.handlePart("m1", "reasoning", 1200, "tui")).toBe(true)
    expect(t.get().get("m1")).toBe(1200)
  })

  test("records tool parts", () => {
    const t = createFirstPartTimeTracker()
    expect(t.handlePart("m1", "tool", 1500, "tui")).toBe(true)
    expect(t.get().get("m1")).toBe(1500)
    expect(t.getSource("m1")).toBe("tui")
  })

  test("tool part does not override existing sdk timing", () => {
    const t = createFirstPartTimeTracker()
    t.handlePart("m1", "text", 1200, "sdk")
    expect(t.handlePart("m1", "tool", 1500, "tui")).toBe(false)
    expect(t.get().get("m1")).toBe(1200)
  })

  test("ignores non-stream part types", () => {
    const t = createFirstPartTimeTracker()
    expect(t.handlePart("m1", "file", 1500, "sdk")).toBe(false)
    expect(t.get().has("m1")).toBe(false)
  })

  test("prefers sdk timing over tui", () => {
    const t = createFirstPartTimeTracker()
    t.handlePart("m1", "text", 2000, "tui")
    expect(t.handlePart("m1", "text", 1500, "tui")).toBe(false)
    expect(t.handlePart("m1", "text", 1500, "sdk")).toBe(true)
    expect(t.get().get("m1")).toBe(1500)
    expect(t.getSource("m1")).toBe("sdk")
  })

  test("reset and dispose clear state", () => {
    const t = createFirstPartTimeTracker()
    t.handlePart("m1", "text", 1500, "sdk")
    t.reset()
    expect(t.get().size).toBe(0)
    t.handlePart("m2", "text", 1600, "sdk")
    t.dispose()
    expect(t.handlePart("m3", "text", 1700, "sdk")).toBe(false)
  })
})

describe("earliestPartStart", () => {
  test("returns earliest valid stream part start", () => {
    const start = earliestPartStart(
      [
        { type: "text", time: { start: 2000 } },
        { type: "reasoning", time: { start: 1500 } },
        { type: "tool", time: { start: 1000 } },
      ],
      1000,
    )
    expect(start).toBe(1500)
  })

  test("ignores starts at or before created", () => {
    const start = earliestPartStart(
      [{ type: "text", time: { start: 1000 } }],
      1000,
    )
    expect(start).toBeUndefined()
  })

  test("returns undefined when no parts", () => {
    expect(earliestPartStart(undefined, 1000)).toBeUndefined()
    expect(earliestPartStart([], 1000)).toBeUndefined()
  })
})
