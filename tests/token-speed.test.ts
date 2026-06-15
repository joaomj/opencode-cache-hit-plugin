import { describe, expect, test } from "bun:test"
import {
  computeTokenSpeed,
  computeAvgTokenSpeed,
  formatTokenSpeed,
  estimateStreamingSpeed,
  advanceStreamingNow,
  formatStreamingNowDisplay,
  initialStreamingTickState,
  STREAMING_HOLD_MS,
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

describe("advanceStreamingNow", () => {
  const part = (id: string) => {
    if (id !== "m1") return undefined
    return [{ type: "text", text: "abcdefgh" }]
  }

  test("idle when no in-flight assistant message", () => {
    const r = advanceStreamingNow(initialStreamingTickState(), {
      messages: [{ role: "assistant", time: { created: 0, completed: 1000 } }],
      now: 5000,
    })
    expect(r.phase).toBe("idle")
    expect(r.speed).toBe(0)
  })

  test("warmup during in-flight before measurable speed", () => {
    const r = advanceStreamingNow(initialStreamingTickState(), {
      messages: [{ role: "assistant", id: "m1", time: { created: 9900 } }],
      part,
      now: 10000,
    })
    expect(r.phase).toBe("warmup")
    expect(r.wasInFlight).toBe(true)
  })

  test("active with positive speed while streaming", () => {
    const r = advanceStreamingNow(initialStreamingTickState(), {
      messages: [{ role: "assistant", id: "m1", time: { created: 0 } }],
      part,
      now: 1000,
    })
    expect(r.phase).toBe("active")
    expect(r.speed).toBe(2)
    expect(r.lastActiveSpeed).toBe(2)
  })

  test("holds last speed briefly after stream ends", () => {
    const active = advanceStreamingNow(initialStreamingTickState(), {
      messages: [{ role: "assistant", id: "m1", time: { created: 0 } }],
      part,
      now: 1000,
    })
    const hold = advanceStreamingNow(active, {
      messages: [{ role: "assistant", id: "m1", time: { created: 0, completed: 1000 } }],
      now: 1500,
    })
    expect(hold.phase).toBe("hold")
    expect(hold.speed).toBe(2)
    expect(hold.holdUntil).toBe(1500 + STREAMING_HOLD_MS)
  })

  test("returns idle after hold window expires", () => {
    const active = advanceStreamingNow(initialStreamingTickState(), {
      messages: [{ role: "assistant", id: "m1", time: { created: 0 } }],
      part,
      now: 1000,
    })
    const hold = advanceStreamingNow(active, {
      messages: [{ role: "assistant", id: "m1", time: { created: 0, completed: 1000 } }],
      now: 1500,
    })
    const idle = advanceStreamingNow(hold, {
      messages: [{ role: "assistant", id: "m1", time: { created: 0, completed: 1000 } }],
      now: 1500 + STREAMING_HOLD_MS + 1,
    })
    expect(idle.phase).toBe("idle")
  })
})

describe("formatStreamingNowDisplay", () => {
  test("idle shows stable dot label", () => {
    expect(formatStreamingNowDisplay("idle", 0, "·")).toEqual({ value: "·", tone: "idle" })
  })

  test("warmup shows sub-1 tok/s with live tone", () => {
    expect(formatStreamingNowDisplay("warmup", 0, "·")).toEqual({ value: "<1 tok/s", tone: "live" })
  })

  test("hold uses fading tone", () => {
    expect(formatStreamingNowDisplay("hold", 23, "·")).toEqual({ value: "23 tok/s", tone: "fading" })
  })
})
