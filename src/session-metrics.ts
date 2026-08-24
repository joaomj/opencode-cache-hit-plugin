import type { AssistantMessage } from "./types.ts"
import { generationDurationMs, timingFromAssistantMessage } from "./message-timing.ts"

export const SESSION_HISTORY_LIMIT = 10_000

export type SessionSpeedTotals = {
  tokens: number
  durationMs: number
}

export type SessionHistoryResult = {
  speed: SessionSpeedTotals
  messageKeys: string[]
  complete: boolean
}

export const EMPTY_SESSION_SPEED: SessionSpeedTotals = { tokens: 0, durationMs: 0 }

function isInteractiveAssistantMessage(message: AssistantMessage): boolean {
  return message.role === "assistant" && message.summary !== true
}

export function sessionMessageKey(message: AssistantMessage): string | undefined {
  return message.id ?? message.messageID
}

export function speedContribution(
  message: AssistantMessage,
  firstPartTime?: ReadonlyMap<string, number>,
): SessionSpeedTotals | undefined {
  if (!isInteractiveAssistantMessage(message)) return undefined
  const timing = timingFromAssistantMessage(message)
  if (!timing?.isComplete) return undefined
  const tokens = (message.tokens?.output ?? 0) + (message.tokens?.reasoning ?? 0)
  if (tokens <= 0) return undefined
  const durationMs = generationDurationMs(timing, firstPartTime?.get(sessionMessageKey(message) ?? ""))
  if (durationMs === undefined || durationMs < 500) return undefined
  return { tokens, durationMs }
}

export function addSessionSpeed(
  totals: SessionSpeedTotals,
  contribution: SessionSpeedTotals | undefined,
): SessionSpeedTotals {
  if (!contribution) return totals
  return {
    tokens: totals.tokens + contribution.tokens,
    durationMs: totals.durationMs + contribution.durationMs,
  }
}

export function computeSessionSpeed(totals: SessionSpeedTotals): number {
  return totals.durationMs > 0 ? (totals.tokens / totals.durationMs) * 1000 : 0
}

export function aggregateSessionSpeed(
  messages: readonly AssistantMessage[],
  firstPartTime?: ReadonlyMap<string, number>,
): SessionSpeedTotals {
  let totals = EMPTY_SESSION_SPEED
  for (const message of messages) {
    totals = addSessionSpeed(totals, speedContribution(message, firstPartTime))
  }
  return totals
}

function responseEntries(raw: unknown): unknown[] | null {
  if (Array.isArray(raw)) return raw
  if (!raw || typeof raw !== "object") return null
  const data = (raw as { data?: unknown }).data
  return Array.isArray(data) ? data : null
}

export async function loadSessionSpeed(opts: {
  client: {
    messages?: (opts: {
      path: { id: string }
      query: { directory: string; limit: number }
    }) => Promise<unknown>
  }
  sessionId: string
  directory: string
  fallback: SessionSpeedTotals
}): Promise<SessionHistoryResult> {
  const request = opts.client.messages
  if (!request) return { speed: opts.fallback, messageKeys: [], complete: false }

  let raw: unknown
  try {
    raw = await request({
      path: { id: opts.sessionId },
      query: { directory: opts.directory, limit: SESSION_HISTORY_LIMIT },
    })
  } catch {
    return { speed: opts.fallback, messageKeys: [], complete: false }
  }

  const entries = responseEntries(raw)
  if (!entries) return { speed: opts.fallback, messageKeys: [], complete: false }

  let speed = EMPTY_SESSION_SPEED
  const messageKeys: string[] = []
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") return { speed: opts.fallback, messageKeys: [], complete: false }
    const info = (entry as { info?: unknown }).info
    if (!info || typeof info !== "object") return { speed: opts.fallback, messageKeys: [], complete: false }
    const message = info as AssistantMessage
    if (message.role !== "assistant") continue
    speed = addSessionSpeed(speed, speedContribution(message))
    const key = sessionMessageKey(message)
    if (key) messageKeys.push(key)
  }

  return {
    speed,
    messageKeys,
    complete: entries.length < SESSION_HISTORY_LIMIT,
  }
}
