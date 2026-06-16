/** Tracks first streaming part timestamp per message for TTFT (UI + timeline). */

export const STREAM_PART_TYPES = new Set(["text", "reasoning"])

export type FirstPartTimeTracker = {
  handlePart: (
    messageID: string,
    partType: string,
    startTime: number,
    source?: "sdk" | "tui",
  ) => boolean
  getSource: (messageID: string) => "sdk" | "tui" | undefined
  get: () => ReadonlyMap<string, number>
  reset: () => void
  dispose: () => void
}

export function createFirstPartTimeTracker(): FirstPartTimeTracker {
  let disposed = false
  const firstPartTime = new Map<string, number>()
  const firstPartSource = new Map<string, "sdk" | "tui">()

  const handlePart = (
    messageID: string,
    partType: string,
    startTime: number,
    source: "sdk" | "tui" = "sdk",
  ): boolean => {
    if (disposed || !messageID || !STREAM_PART_TYPES.has(partType)) return false

    const existing = firstPartTime.get(messageID)
    const existingSource = firstPartSource.get(messageID)

    if (existing !== undefined && existingSource === "sdk") return false

    if (existing !== undefined && existingSource === "tui" && source === "sdk") {
      firstPartTime.set(messageID, startTime)
      firstPartSource.set(messageID, source)
      return true
    }

    if (existing === undefined) {
      firstPartTime.set(messageID, startTime)
      firstPartSource.set(messageID, source)
      return true
    }

    return false
  }

  return {
    handlePart,
    getSource: (messageID) => firstPartSource.get(messageID),
    get: () => firstPartTime,
    reset: () => {
      firstPartTime.clear()
      firstPartSource.clear()
    },
    dispose: () => {
      disposed = true
      firstPartTime.clear()
      firstPartSource.clear()
    },
  }
}

/** Earliest stream part start from api.state.part() when part events were missed. */
export function earliestPartStart(
  parts: ReadonlyArray<{ type: string; time?: { start?: number } }> | undefined,
  created: number,
): number | undefined {
  if (!parts?.length) return undefined
  let earliest: number | undefined
  for (const p of parts) {
    if (!STREAM_PART_TYPES.has(p.type)) continue
    const start = p.time?.start
    if (typeof start !== "number" || start <= created) continue
    if (earliest === undefined || start < earliest) earliest = start
  }
  return earliest
}
