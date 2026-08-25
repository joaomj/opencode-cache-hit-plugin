const STREAM_PART_TYPES = new Set(["text", "reasoning"])

export type FirstPartTimeTracker = {
  handlePart: (messageID: string, partType: string, startTime: number) => boolean
  get: () => ReadonlyMap<string, number>
  reset: () => void
  dispose: () => void
}

export function createFirstPartTimeTracker(): FirstPartTimeTracker {
  let disposed = false
  const firstPartTime = new Map<string, number>()

  const handlePart = (messageID: string, partType: string, startTime: number): boolean => {
    if (disposed || !messageID || !STREAM_PART_TYPES.has(partType) || !Number.isFinite(startTime)) {
      return false
    }
    const existing = firstPartTime.get(messageID)
    if (existing !== undefined && startTime >= existing) return false
    firstPartTime.set(messageID, startTime)
    return true
  }

  return {
    handlePart,
    get: () => firstPartTime,
    reset: () => firstPartTime.clear(),
    dispose: () => {
      disposed = true
      firstPartTime.clear()
    },
  }
}

/** Recover the first generated part when the live event was missed. */
export function earliestPartStart(
  parts: ReadonlyArray<{ type: string; time?: { start?: number } }> | undefined,
  created: number,
): number | undefined {
  if (!parts?.length) return undefined
  let earliest: number | undefined
  for (const part of parts) {
    if (!STREAM_PART_TYPES.has(part.type)) continue
    const start = part.time?.start
    if (typeof start !== "number" || !Number.isFinite(start) || start <= created) continue
    if (earliest === undefined || start < earliest) earliest = start
  }
  return earliest
}
