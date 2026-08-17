import type { DynamicPricingSchedule, TimeWindow } from "./types.ts"

const MINUTES_PER_DAY = 24 * 60

/** "09:00" → 540；"18:30" → 1110。非法输入返回 null。 */
export function parseClockTime(raw: string): number | null {
  const m = raw.match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

export function inWindow(dayMinute: number, w: TimeWindow): boolean {
  if (w.start <= w.end) return dayMinute >= w.start && dayMinute < w.end
  // 跨天窗口：[start, 24:00) ∪ [00:00, end)
  return dayMinute >= w.start || dayMinute < w.end
}

export type TzParts = {
  year: number
  month: number // 1-12
  day: number
  hour: number // 0-23（"24:xx" 已归一化）
  minute: number
  second: number
}

const tzFormatterCache = new Map<string, Intl.DateTimeFormat>()

function tzFormatter(timezone: string): Intl.DateTimeFormat {
  let f = tzFormatterCache.get(timezone)
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
    tzFormatterCache.set(timezone, f)
  }
  return f
}

/** 取某时刻在指定时区的日历字段（hour "24" 归一化为次日 0 点）。 */
export function tzPartsOf(ts: number, timezone: string): TzParts {
  const parts = Object.fromEntries(
    tzFormatter(timezone).formatToParts(new Date(ts)).map((p) => [p.type, p.value]),
  )
  let year = Number(parts.year)
  let month = Number(parts.month)
  let day = Number(parts.day)
  let hour = Number(parts.hour)
  const minute = Number(parts.minute)
  const second = Number(parts.second)
  if (hour === 24) {
    hour = 0
    const d = new Date(Date.UTC(year, month - 1, day + 1))
    year = d.getUTCFullYear()
    month = d.getUTCMonth() + 1
    day = d.getUTCDate()
  }
  return { year, month, day, hour, minute, second }
}

/** 指定时区下"当天 00:00:00"的 epoch 毫秒（真实时区零点，非 UTC 零点）。 */
export function startOfDayEpoch(ts: number, timezone: string): number {
  const p = tzPartsOf(ts, timezone)
  const elapsedMs = p.hour * 3_600_000 + p.minute * 60_000 + p.second * 1000
  return Math.floor(ts / 1000) * 1000 - elapsedMs
}

/** 指定时区下该时刻的"当天分钟数"（0..1439.99）。 */
export function dayMinuteOf(ts: number, timezone: string): number {
  const p = tzPartsOf(ts, timezone)
  return p.hour * 60 + p.minute + p.second / 60
}

/**
 * 判定 now 命中的时段档名（按 schedule 顺序，首个匹配）。
 * schedule 为空或未命中 → undefined。
 */
export function isLevelAt(
  now: number,
  schedule: DynamicPricingSchedule,
  timezone: string,
): string | undefined {
  if (schedule.length === 0) return undefined
  const min = dayMinuteOf(now, timezone)
  for (const lvl of schedule) {
    for (const w of lvl.windows) {
      if (inWindow(min, w)) return lvl.level
    }
  }
  return undefined
}

/**
 * 距下一个时段窗口边界（任一 level 任一 window 的 start/end）的毫秒数。
 * 用于精确调度 UI 刷新；无任何边界时返回 24h。
 */
export function nextBoundaryMs(
  now: number,
  schedule: DynamicPricingSchedule,
  timezone: string,
): number {
  const todayMin = dayMinuteOf(now, timezone)
  let best = Number.POSITIVE_INFINITY
  for (const lvl of schedule) {
    for (const w of lvl.windows) {
      for (const m of [w.start, w.end]) {
        let dayOffset = 0
        if (m <= todayMin) dayOffset = 1 // 当天该边界已过 → 次日
        const boundaryMs = startOfDayEpoch(now, timezone) + (m + dayOffset * MINUTES_PER_DAY) * 60_000
        if (boundaryMs > now) best = Math.min(best, boundaryMs - now)
      }
    }
  }
  return Number.isFinite(best) ? best : MINUTES_PER_DAY * 60_000
}
