import { timingFromAssistantMessage } from "../message-timing.ts"
import { perMessageHitPercent } from "../stats.ts"
import type { AssistantMessage } from "../types.ts"
import type { LlmCallRecord } from "./types.ts"
import type { ToolDurationRecord } from "../tool-timing.ts"
import { computeSessionSpeed, speedContributionForTiming } from "../session-metrics.ts"
import type { VisibleTextTiming } from "../first-part-time.ts"

/** Convert milliseconds timestamp to ISO 8601 with local timezone offset. */
export function msToISOString(ms: number): string {
  const d = new Date(ms)
  const off = -d.getTimezoneOffset()
  const sign = off >= 0 ? "+" : "-"
  const hh = String(Math.floor(Math.abs(off) / 60)).padStart(2, "0")
  const mm = String(Math.abs(off) % 60).padStart(2, "0")
  const pad = (n: number, len = 2) => String(n).padStart(len, "0")
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `.${pad(d.getMilliseconds(), 3)}${sign}${hh}:${mm}`
  )
}

export function messageKeyFor(msg: AssistantMessage, sessionId: string): string {
  const id = msg.id ?? msg.messageID
  if (typeof id === "string" && id.length > 0) return `${sessionId}:${id}`
  const created = msg.time?.created ?? 0
  return `${sessionId}:${created}`
}

export function assistantMessageToRecord(
  msg: AssistantMessage,
  sessionId: string,
  recordedAt: number,
  toolDurations?: ToolDurationRecord[],
  textTiming?: VisibleTextTiming,
): LlmCallRecord | null {
  if (msg.role !== "assistant") return null
  const timing = timingFromAssistantMessage(msg)
  if (!timing) return null
  const t = msg.tokens ?? {}
  const skippedForHit = msg.summary === true
  const output = t.output ?? 0
  const reasoning = t.reasoning ?? 0
  const contribution = speedContributionForTiming(msg, textTiming)
  const tps = contribution ? computeSessionSpeed(contribution) : undefined
  return {
    schema: 1,
    recordedAt: msToISOString(recordedAt),
    sessionId,
    messageKey: messageKeyFor(msg, sessionId),
    created: msToISOString(timing.created),
    completedAt: timing.completedAt !== undefined ? msToISOString(timing.completedAt) : undefined,
    durationMs: timing.durationMs,
    isComplete: timing.isComplete,
    input: t.input ?? 0,
    output,
    reasoning: t.reasoning ?? 0,
    cacheRead: t.cache?.read ?? 0,
    cacheWrite: t.cache?.write ?? 0,
    cost: msg.cost ?? 0,
    hitPercent: perMessageHitPercent(msg),
    skippedForHit,
    tps,
    finish: msg.finish,
    toolDurations,
  }
}
