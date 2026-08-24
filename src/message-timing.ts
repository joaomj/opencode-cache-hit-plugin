import type { AssistantMessage } from "./types.ts"

/** Milliseconds since epoch (OpenCode SDK v2). */
export type MessageTiming = {
  created: number
  completedAt?: number
  durationMs?: number
  isComplete: boolean
}

/**
 * Per-call timing from AssistantMessage.time (SDK).
 * - created: always set when message exists
 * - completed: set when the LLM turn finishes (reliable for finished calls)
 * Use completed ?? created for ordering finished calls; in-flight calls lack completed.
 */
export function timingFromAssistantMessage(msg: AssistantMessage): MessageTiming | null {
  const t = msg.time
  if (!t || typeof t.created !== "number") return null
  const completedAt = typeof t.completed === "number" ? t.completed : undefined
  return {
    created: t.created,
    completedAt,
    durationMs: completedAt !== undefined ? completedAt - t.created : undefined,
    isComplete: completedAt !== undefined,
  }
}

/** Completed turn duration for speed metrics. */
export function generationDurationMs(timing: MessageTiming): number | undefined {
  if (!timing.isComplete || timing.completedAt === undefined) return undefined
  return timing.durationMs
}

export function formatTimingShort(ms: number): string {
  const d = new Date(ms)
  const h = String(d.getHours()).padStart(2, "0")
  const m = String(d.getMinutes()).padStart(2, "0")
  const s = String(d.getSeconds()).padStart(2, "0")
  return `${h}:${m}:${s}`
}
