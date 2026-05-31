import { timingFromAssistantMessage } from "../message-timing.ts"
import { perMessageHitPercent } from "../stats.ts"
import type { AssistantMessage } from "../types.ts"
import type { LlmCallRecord } from "./types.ts"

export function messageKeyFor(msg: AssistantMessage, sessionId: string): string {
  const id = msg.id ?? msg.messageID
  if (typeof id === "string" && id.length > 0) return `${sessionId}:${id}`
  const created = msg.time?.created ?? 0
  return `${sessionId}:${created}:${msg.modelID ?? ""}`
}

export function sortKeyForRecord(r: LlmCallRecord): number {
  return r.completedAt ?? r.created
}

export function assistantMessageToRecord(
  msg: AssistantMessage,
  sessionId: string,
  rootSessionId: string,
  scope: "main" | "child",
  recordedAt: number,
): LlmCallRecord | null {
  if (msg.role !== "assistant") return null
  const timing = timingFromAssistantMessage(msg)
  if (!timing) return null
  const t = msg.tokens ?? {}
  const skippedForHit = msg.summary === true
  return {
    schema: 1,
    recordedAt,
    sessionId,
    rootSessionId,
    scope,
    messageKey: messageKeyFor(msg, sessionId),
    modelId: msg.modelID ?? "",
    created: timing.created,
    completedAt: timing.completedAt,
    durationMs: timing.durationMs,
    isComplete: timing.isComplete,
    input: t.input ?? 0,
    output: t.output ?? 0,
    reasoning: t.reasoning ?? 0,
    cacheRead: t.cache?.read ?? 0,
    cacheWrite: t.cache?.write ?? 0,
    cost: msg.cost ?? 0,
    hitPercent: perMessageHitPercent(msg),
    skippedForHit,
  }
}

export function buildCallRecords(
  sessionId: string,
  rootSessionId: string,
  scope: "main" | "child",
  messages: readonly AssistantMessage[],
  opts?: { logSummaryMessages?: boolean; recordedAt?: number },
): LlmCallRecord[] {
  const now = opts?.recordedAt ?? Date.now()
  const logSummary = opts?.logSummaryMessages !== false
  const out: LlmCallRecord[] = []
  for (const msg of messages) {
    if (!logSummary && msg.summary === true) continue
    const rec = assistantMessageToRecord(msg, sessionId, rootSessionId, scope, now)
    if (rec) out.push(rec)
  }
  return out
}

export function mergeAndSortRecords(chunks: readonly LlmCallRecord[][]): LlmCallRecord[] {
  const all = chunks.flat()
  return all.sort((a, b) => sortKeyForRecord(a) - sortKeyForRecord(b))
}
