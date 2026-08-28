const VISIBLE_PART_TYPE = "text"

export type VisibleTextTiming = {
  start: number
  end?: number
}

export type FirstPartTimeTracker = {
  handlePart: (messageID: string, partType: string, startTime: number, endTime?: number) => boolean
  get: () => ReadonlyMap<string, VisibleTextTiming>
  reset: () => void
  dispose: () => void
}

export function createFirstPartTimeTracker(): FirstPartTimeTracker {
  let disposed = false
  const textTiming = new Map<string, VisibleTextTiming>()

  const handlePart = (messageID: string, partType: string, startTime: number, endTime?: number): boolean => {
    if (disposed || !messageID || partType !== VISIBLE_PART_TYPE || !Number.isFinite(startTime)) {
      return false
    }
    const existing = textTiming.get(messageID)
    const next: VisibleTextTiming = {
      start: existing ? Math.min(existing.start, startTime) : startTime,
      ...(existing?.end !== undefined ? { end: existing.end } : {}),
    }
    if (Number.isFinite(endTime) && endTime > next.start) {
      next.end = Math.max(next.end ?? endTime, endTime)
    }
    if (existing && existing.start === next.start && existing.end === next.end) return false
    textTiming.set(messageID, next)
    return true
  }

  return {
    handlePart,
    get: () => textTiming,
    reset: () => textTiming.clear(),
    dispose: () => {
      disposed = true
      textTiming.clear()
    },
  }
}

/** Recover visible text timing when the live event was missed. */
export function visibleTextTimingFromParts(
  parts: ReadonlyArray<{
    type: string
    synthetic?: boolean
    ignored?: boolean
    time?: { start?: number; end?: number }
  }> | undefined,
  created: number,
): VisibleTextTiming | undefined {
  if (!parts?.length) return undefined
  let start: number | undefined
  let end: number | undefined
  for (const part of parts) {
    if (part.type !== VISIBLE_PART_TYPE || part.synthetic || part.ignored) continue
    const partStart = part.time?.start
    if (typeof partStart !== "number" || !Number.isFinite(partStart) || partStart <= created) continue
    start = start === undefined ? partStart : Math.min(start, partStart)
    const partEnd = part.time?.end
    if (typeof partEnd === "number" && Number.isFinite(partEnd) && partEnd > partStart) {
      end = end === undefined ? partEnd : Math.max(end, partEnd)
    }
  }
  return start === undefined ? undefined : { start, ...(end !== undefined ? { end } : {}) }
}

export function mergeVisibleTextTiming(
  known: VisibleTextTiming | undefined,
  recovered: VisibleTextTiming | undefined,
): VisibleTextTiming | undefined {
  if (!known) return recovered
  if (!recovered) return known
  const start = Math.min(known.start, recovered.start)
  const end = Math.max(known.end ?? 0, recovered.end ?? 0)
  return { start, ...(end > 0 ? { end } : {}) }
}

/** Recover the first visible text timestamp for older callers. */
export function earliestPartStart(
  parts: ReadonlyArray<{
    type: string
    synthetic?: boolean
    ignored?: boolean
    time?: { start?: number }
  }> | undefined,
  created: number,
): number | undefined {
  return visibleTextTimingFromParts(parts, created)?.start
}
