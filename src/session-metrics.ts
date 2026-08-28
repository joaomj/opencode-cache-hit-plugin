import type { AssistantMessage } from "./types.ts"
import {
  mergeVisibleTextTiming,
  visibleTextTimingFromParts,
  type VisibleTextTiming,
} from "./first-part-time.ts"
import { generationDurationMs, timingFromAssistantMessage } from "./message-timing.ts"

export const SESSION_HISTORY_LIMIT = 10_000
export const MIN_GENERATION_WINDOW_MS = 250

export type SessionSpeedTotals = {
  tokens: number
  durationMs: number
}

export type SessionHistoryResult = {
  speed: SessionSpeedTotals
  lastTurn?: SessionSpeedTotals
  messageKeys: string[]
  complete: boolean
}

export type SessionSpeedMetrics = {
  session: SessionSpeedTotals
  lastTurn?: SessionSpeedTotals
}

export const EMPTY_SESSION_SPEED: SessionSpeedTotals = { tokens: 0, durationMs: 0 }

function isInteractiveAssistantMessage(message: AssistantMessage): boolean {
  return message.role === "assistant" && message.summary !== true
}

export function sessionMessageKey(message: AssistantMessage): string | undefined {
  return message.id ?? message.messageID
}

function speedContributionAt(
  message: AssistantMessage,
  textTiming: VisibleTextTiming | undefined,
): SessionSpeedTotals | undefined {
  if (!isInteractiveAssistantMessage(message)) return undefined
  if (message.finish !== "stop" && message.finish !== "length") return undefined
  const timing = timingFromAssistantMessage(message)
  if (!timing) return undefined
  const output = message.tokens?.output ?? 0
  const durationMs = generationDurationMs(timing, textTiming)
  if (output <= 1 || durationMs === undefined || durationMs < MIN_GENERATION_WINDOW_MS) return undefined
  return { tokens: output - 1, durationMs }
}

export function speedContributionForTiming(
  message: AssistantMessage,
  textTiming: VisibleTextTiming | undefined,
): SessionSpeedTotals | undefined {
  return speedContributionAt(message, textTiming)
}

export function speedContribution(
  message: AssistantMessage,
  textTiming?: ReadonlyMap<string, VisibleTextTiming>,
): SessionSpeedTotals | undefined {
  const key = sessionMessageKey(message)
  return speedContributionAt(message, key ? textTiming?.get(key) : undefined)
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
  return totals.durationMs > 0 && totals.tokens > 0 ? (totals.tokens / totals.durationMs) * 1000 : 0
}

export function aggregateSessionSpeed(
  messages: readonly AssistantMessage[],
  textTiming?: ReadonlyMap<string, VisibleTextTiming>,
): SessionSpeedTotals {
  let totals = EMPTY_SESSION_SPEED
  for (const message of messages) {
    totals = addSessionSpeed(totals, speedContribution(message, textTiming))
  }
  return totals
}

function isCompletedTurnMessage(message: AssistantMessage): boolean {
  return message.role === "assistant" && (message.finish === "stop" || message.finish === "length")
}

/** Find the newest completed user turn, skipping the active turn. */
export function lastCompletedTurnSpeed(
  messages: readonly AssistantMessage[],
  textTiming?: ReadonlyMap<string, VisibleTextTiming>,
): SessionSpeedTotals | undefined {
  let totals = EMPTY_SESSION_SPEED
  let completed = false
  let latestAssistantComplete = true
  let sawAssistant = false

  const finishTurn = () => {
    if (completed && latestAssistantComplete && totals.durationMs > 0 && totals.tokens > 0) return totals
    totals = EMPTY_SESSION_SPEED
    completed = false
    latestAssistantComplete = true
    sawAssistant = false
    return undefined
  }

  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index]
    if (message.role === "user") {
      const result = finishTurn()
      if (result) return result
      continue
    }
    if (message.role !== "assistant" || message.summary === true) continue
    if (!sawAssistant) {
      latestAssistantComplete = isCompletedTurnMessage(message)
      sawAssistant = true
    }
    if (isCompletedTurnMessage(message)) completed = true
    totals = addSessionSpeed(totals, speedContribution(message, textTiming))
  }
  return finishTurn()
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
  fallbackLastTurn?: SessionSpeedTotals
  textTiming?: ReadonlyMap<string, VisibleTextTiming>
  part?: (messageID: string) => ReadonlyArray<{
    type: string
    synthetic?: boolean
    ignored?: boolean
    time?: { start?: number; end?: number }
  }> | undefined
}): Promise<SessionHistoryResult> {
  const request = opts.client.messages
  if (!request) return { speed: opts.fallback, lastTurn: opts.fallbackLastTurn, messageKeys: [], complete: false }

  let raw: unknown
  try {
    raw = await request({
      path: { id: opts.sessionId },
      query: { directory: opts.directory, limit: SESSION_HISTORY_LIMIT },
    })
  } catch {
    return { speed: opts.fallback, lastTurn: opts.fallbackLastTurn, messageKeys: [], complete: false }
  }

  const entries = responseEntries(raw)
  if (!entries) return { speed: opts.fallback, lastTurn: opts.fallbackLastTurn, messageKeys: [], complete: false }

  let speed = EMPTY_SESSION_SPEED
  const messageKeys: string[] = []
  const messages: AssistantMessage[] = []
  const timings = new Map<string, VisibleTextTiming>()
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") {
      return { speed: opts.fallback, lastTurn: opts.fallbackLastTurn, messageKeys: [], complete: false }
    }
    const info = (entry as { info?: unknown }).info
    if (!info || typeof info !== "object") {
      return { speed: opts.fallback, lastTurn: opts.fallbackLastTurn, messageKeys: [], complete: false }
    }
    const message = info as AssistantMessage
    messages.push(message)
    if (message.role !== "assistant") continue
    const key = sessionMessageKey(message)
    const created = message.time?.created
    const recoveredTiming = key && typeof created === "number"
      ? visibleTextTimingFromParts(opts.part?.(key), created)
      : undefined
    const timing = mergeVisibleTextTiming(key ? opts.textTiming?.get(key) : undefined, recoveredTiming)
    if (key && timing) timings.set(key, timing)
    speed = addSessionSpeed(speed, speedContributionAt(message, timing))
    if (key) messageKeys.push(key)
  }

  return {
    speed,
    lastTurn: lastCompletedTurnSpeed(messages, timings) ?? opts.fallbackLastTurn,
    messageKeys,
    complete: entries.length < SESSION_HISTORY_LIMIT,
  }
}
