import { describe, test, expect } from "bun:test"
import {
  parseClockTime,
  inWindow,
  tzPartsOf,
  startOfDayEpoch,
  dayMinuteOf,
  isLevelAt,
  nextBoundaryMs,
} from "../src/dynamic-pricing/schedule.ts"
import { DEFAULT_SCHEDULE } from "../src/dynamic-pricing/types.ts"

const TZ = "Asia/Shanghai" // UTC+8，无 DST

/** 北京时间 y-m-d h:m → epoch ms。 */
function bjt(y: number, m: number, d: number, h: number, min = 0, s = 0): number {
  return Date.UTC(y, m - 1, d, h - 8, min, s)
}

describe("parseClockTime", () => {
  test("parses HH:MM", () => {
    expect(parseClockTime("09:00")).toBe(540)
    expect(parseClockTime("18:30")).toBe(1110)
    expect(parseClockTime("00:00")).toBe(0)
    expect(parseClockTime("23:59")).toBe(1439)
  })
  test("rejects invalid input", () => {
    expect(parseClockTime("9")).toBeNull()
    expect(parseClockTime("24:00")).toBeNull()
    expect(parseClockTime("09:60")).toBeNull()
    expect(parseClockTime("abc")).toBeNull()
  })
})

describe("inWindow", () => {
  test("same-day window is half-open", () => {
    const w = { start: 540, end: 720 } // 09:00-12:00
    expect(inWindow(540, w)).toBe(true)
    expect(inWindow(719, w)).toBe(true)
    expect(inWindow(720, w)).toBe(false)
    expect(inWindow(539, w)).toBe(false)
  })
  test("cross-day window covers wrap-around", () => {
    const w = { start: 1080, end: 540 } // 18:00 - 次日09:00
    expect(inWindow(1080, w)).toBe(true)
    expect(inWindow(1439, w)).toBe(true)
    expect(inWindow(0, w)).toBe(true)
    expect(inWindow(539, w)).toBe(true)
    expect(inWindow(540, w)).toBe(false)
    expect(inWindow(1000, w)).toBe(false)
  })
})

describe("tzPartsOf / dayMinuteOf", () => {
  test("maps epoch to Beijing wall clock", () => {
    const ts = bjt(2026, 8, 10, 10, 30, 15)
    expect(tzPartsOf(ts, TZ)).toEqual({ year: 2026, month: 8, day: 10, hour: 10, minute: 30, second: 15 })
    expect(dayMinuteOf(ts, TZ)).toBe(10 * 60 + 30 + 15 / 60)
    expect(startOfDayEpoch(ts, TZ)).toBe(bjt(2026, 8, 10, 0))
  })
})

describe("isLevelAt (DeepSeek schedule)", () => {
  test("peak windows", () => {
    expect(isLevelAt(bjt(2026, 8, 10, 9, 0), DEFAULT_SCHEDULE, TZ)).toBe("peak")
    expect(isLevelAt(bjt(2026, 8, 10, 11, 59), DEFAULT_SCHEDULE, TZ)).toBe("peak")
    expect(isLevelAt(bjt(2026, 8, 10, 14, 0), DEFAULT_SCHEDULE, TZ)).toBe("peak")
    expect(isLevelAt(bjt(2026, 8, 10, 17, 59), DEFAULT_SCHEDULE, TZ)).toBe("peak")
  })
  test("offpeak boundaries", () => {
    expect(isLevelAt(bjt(2026, 8, 10, 12, 0), DEFAULT_SCHEDULE, TZ)).toBe("offpeak")
    expect(isLevelAt(bjt(2026, 8, 10, 13, 30), DEFAULT_SCHEDULE, TZ)).toBe("offpeak")
    expect(isLevelAt(bjt(2026, 8, 10, 18, 0), DEFAULT_SCHEDULE, TZ)).toBe("offpeak")
    expect(isLevelAt(bjt(2026, 8, 10, 23, 59), DEFAULT_SCHEDULE, TZ)).toBe("offpeak")
    expect(isLevelAt(bjt(2026, 8, 10, 0, 30), DEFAULT_SCHEDULE, TZ)).toBe("offpeak")
    expect(isLevelAt(bjt(2026, 8, 10, 8, 59), DEFAULT_SCHEDULE, TZ)).toBe("offpeak")
  })
  test("empty schedule returns undefined", () => {
    expect(isLevelAt(Date.now(), [], TZ)).toBeUndefined()
  })
})

describe("nextBoundaryMs", () => {
  test("next boundary within the day", () => {
    // 10:00 → 12:00（2h）
    expect(nextBoundaryMs(bjt(2026, 8, 10, 10, 0), DEFAULT_SCHEDULE, TZ)).toBe(2 * 3_600_000)
    // 13:00 → 14:00（1h）
    expect(nextBoundaryMs(bjt(2026, 8, 10, 13, 0), DEFAULT_SCHEDULE, TZ)).toBe(3_600_000)
    // 08:00 → 09:00（1h）
    expect(nextBoundaryMs(bjt(2026, 8, 10, 8, 0), DEFAULT_SCHEDULE, TZ)).toBe(3_600_000)
  })
  test("rolls to tomorrow after 18:00", () => {
    // 18:30 → 次日 09:00（14.5h）
    expect(nextBoundaryMs(bjt(2026, 8, 10, 18, 30), DEFAULT_SCHEDULE, TZ)).toBe(14.5 * 3_600_000)
    // 23:59 → 次日 09:00
    expect(nextBoundaryMs(bjt(2026, 8, 10, 23, 59), DEFAULT_SCHEDULE, TZ)).toBe(9 * 3_600_000 + 60_000)
  })
  test("empty schedule falls back to 24h", () => {
    expect(nextBoundaryMs(Date.now(), [], TZ)).toBe(24 * 3_600_000)
  })
})
