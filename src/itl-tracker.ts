/**
 * Tracks chunk arrival timestamps during streaming to compute ITL (Inter-Token Latency).
 *
 * ITL = time between consecutive `message.part.delta` events for text/reasoning chunks.
 * While TPOT is a turn-level average, ITL captures micro-fluctuations: a turn with
 * stable 50ms/tok looks very different from one that alternates 10ms/200ms chunks.
 *
 * Stores pre-computed P50/P90 to the timeline JSONL (raw samples are discarded).
 * Internal buffer capped at 500 timestamps to bound memory in long generations.
 */
export type ItlQuantiles = {
  p50: number
  p90: number
  /** Number of inter-chunk intervals used (sample count). */
  count: number
}

export type ItlTracker = {
  /** Record a chunk arrival for the given message. Optional timestamp for testing. */
  trackChunk: (messageId: string, timestampMs?: number) => void
  /** Get P50/P90 inter-chunk intervals (ms) for a completed message, or undefined. */
  getQuantiles: (messageId: string) => ItlQuantiles | undefined
  /** Clear all per-message state (on root session switch or dispose). */
  reset: () => void
}

const MAX_SAMPLES = 500

function quantile(sorted: number[], k: number): number {
  const idx = Math.max(0, Math.ceil(sorted.length * k) - 1)
  return sorted[idx]
}

export function createItlTracker(): ItlTracker {
  const chunks = new Map<string, number[]>()

  function trackChunk(messageId: string, timestampMs?: number): void {
    let list = chunks.get(messageId)
    if (!list) {
      list = []
      chunks.set(messageId, list)
    }
    if (list.length >= MAX_SAMPLES) return
    list.push(timestampMs ?? Date.now())
  }

  function getQuantiles(messageId: string): ItlQuantiles | undefined {
    const list = chunks.get(messageId)
    if (!list || list.length < 2) return undefined
    const deltas: number[] = []
    for (let i = 1; i < list.length; i++) {
      const dt = list[i] - list[i - 1]
      if (dt > 0) deltas.push(dt)
    }
    if (deltas.length === 0) return undefined
    deltas.sort((a, b) => a - b)
    return {
      p50: quantile(deltas, 0.5),
      p90: quantile(deltas, 0.9),
      count: deltas.length,
    }
  }

  function reset(): void {
    chunks.clear()
  }

  return { trackChunk, getQuantiles, reset }
}
