import { describe, test, expect } from "bun:test"
import { timingFromAssistantMessage, formatTimingShort, generationDurationMs } from "../src/message-timing.ts"

describe("timingFromAssistantMessage", () => {
  test("reads created and completed from SDK shape", () => {
    const t = timingFromAssistantMessage({
      role: "assistant",
      time: { created: 1_700_000_000_000, completed: 1_700_000_005_000 },
    })
    expect(t?.created).toBe(1_700_000_000_000)
    expect(t?.completedAt).toBe(1_700_000_005_000)
    expect(t?.durationMs).toBe(5000)
    expect(t?.isComplete).toBe(true)
  })

  test("in-flight call has no completed", () => {
    const t = timingFromAssistantMessage({
      role: "assistant",
      time: { created: 1000 },
    })
    expect(t?.isComplete).toBe(false)
    expect(t?.completedAt).toBeUndefined()
  })

  test("missing time returns null", () => {
    expect(timingFromAssistantMessage({ role: "assistant" })).toBeNull()
  })
})

describe("generationDurationMs", () => {
  test("uses first visible text to last visible text", () => {
    const timing = timingFromAssistantMessage({
      role: "assistant",
      time: { created: 1000, completed: 3000 },
    })!
    expect(generationDurationMs(timing, { start: 1500, end: 2700 })).toBe(1200)
  })

  test("falls back to completed when visible text end is unavailable", () => {
    const timing = timingFromAssistantMessage({
      role: "assistant",
      time: { created: 1000, completed: 3000 },
    })!
    expect(generationDurationMs(timing, { start: 1500 })).toBe(1500)
  })

  test("does not fall back when generation is in-flight", () => {
    const timing = timingFromAssistantMessage({
      role: "assistant",
      time: { created: 1000 },
    })!
    expect(generationDurationMs(timing, { start: 1500 })).toBeUndefined()
  })

  test("rejects invalid visible text timestamps", () => {
    const timing = timingFromAssistantMessage({
      role: "assistant",
      time: { created: 1000, completed: 3000 },
    })!
    expect(generationDurationMs(timing, { start: 1000, end: 1000 })).toBeUndefined()
    expect(generationDurationMs(timing, { start: 3000, end: 3500 })).toBe(500)
    expect(generationDurationMs(timing, { start: 3500, end: 3000 })).toBeUndefined()
  })
})

describe("formatTimingShort", () => {
  test("formats local time", () => {
    const s = formatTimingShort(new Date("2024-01-15T14:30:45").getTime())
    expect(s).toMatch(/^\d{2}:\d{2}:\d{2}$/)
  })
})
