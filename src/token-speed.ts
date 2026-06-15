import { generationDurationMs, timingFromAssistantMessage } from "./message-timing.ts"
import type { AssistantMessage } from "./types.ts"

export type StreamingPhase = "idle" | "warmup" | "active" | "hold"

export const STREAMING_HOLD_MS = 2000

export type StreamingTickState = {
  holdUntil: number
  lastActiveSpeed: number
  wasInFlight: boolean
}

export const initialStreamingTickState = (): StreamingTickState => ({
  holdUntil: 0,
  lastActiveSpeed: 0,
  wasInFlight: false,
})

export type StreamingNowTone = "live" | "fading" | "idle"

export function formatStreamingNowDisplay(
  phase: StreamingPhase,
  speed: number,
  idleLabel: string,
): { value: string; tone: StreamingNowTone } {
  switch (phase) {
    case "idle":
      return { value: idleLabel, tone: "idle" }
    case "warmup":
      return { value: formatTokenSpeed(0), tone: "live" }
    case "active":
      return { value: formatTokenSpeed(speed), tone: "live" }
    case "hold":
      return { value: formatTokenSpeed(speed), tone: "fading" }
  }
}

function inFlightAssistant(messages: AssistantMessage[]): AssistantMessage | undefined {
  if (!messages.length) return undefined
  const last = messages[messages.length - 1]
  if (last.role !== "assistant" || last.time?.completed) return undefined
  return last
}

function measureInFlightSpeed(
  msg: AssistantMessage,
  part: ((id: string) => ReadonlyArray<{ type: string; text?: string }> | undefined) | undefined,
  now: number,
  firstPartTime?: ReadonlyMap<string, number>,
): number {
  const messageId = msg.id ?? msg.messageID
  const created = msg.time?.created
  if (!messageId || typeof created !== "number" || !part) return 0
  const parts = part(messageId)
  if (!parts?.length) return 0
  const text = parts
    .filter((p) => p.type === "text" || p.type === "reasoning")
    .map((p) => p.text ?? "")
    .join("")
  const firstTime = firstPartTime?.get(messageId)
  return estimateStreamingSpeed(text, created, now, firstTime)
}

export function advanceStreamingNow(
  prev: StreamingTickState,
  input: {
    messages: AssistantMessage[]
    part?: (id: string) => ReadonlyArray<{ type: string; text?: string }> | undefined
    now: number
    firstPartTime?: ReadonlyMap<string, number>
  },
): StreamingTickState & { phase: StreamingPhase; speed: number } {
  const inFlight = inFlightAssistant(input.messages)

  if (inFlight) {
    const speed = measureInFlightSpeed(inFlight, input.part, input.now, input.firstPartTime)
    const phase: StreamingPhase = speed > 0 ? "active" : "warmup"
    return {
      holdUntil: 0,
      lastActiveSpeed: speed > 0 ? speed : prev.lastActiveSpeed,
      wasInFlight: true,
      phase,
      speed: phase === "active" ? speed : 0,
    }
  }

  let holdUntil = prev.holdUntil
  if (prev.wasInFlight && prev.lastActiveSpeed > 0) {
    holdUntil = input.now + STREAMING_HOLD_MS
  }

  if (holdUntil > input.now && prev.lastActiveSpeed > 0) {
    return {
      holdUntil,
      lastActiveSpeed: prev.lastActiveSpeed,
      wasInFlight: false,
      phase: "hold",
      speed: prev.lastActiveSpeed,
    }
  }

  return {
    holdUntil: 0,
    lastActiveSpeed: prev.lastActiveSpeed,
    wasInFlight: false,
    phase: "idle",
    speed: 0,
  }
}

export function computeTokenSpeed(output: number, reasoning: number, durationMs: number): number {
  if (durationMs < 500) return 0
  return ((output + reasoning) / durationMs) * 1000
}

export function computeAvgTokenSpeed(
  messages: AssistantMessage[],
  firstPartTime?: ReadonlyMap<string, number>,
): number {
  let totalTokens = 0
  let totalMs = 0
  for (const msg of messages) {
    if (msg.summary) continue
    const timing = timingFromAssistantMessage(msg)
    if (!timing?.isComplete) continue
    const output = msg.tokens?.output ?? 0
    const reasoning = msg.tokens?.reasoning ?? 0
    if (output + reasoning === 0) continue
    const msgID = msg.id ?? msg.messageID
    const firstTime = msgID ? firstPartTime?.get(msgID) : undefined
    const duration = generationDurationMs(timing, firstTime)
    if (duration === undefined || duration < 500) continue
    totalTokens += output + reasoning
    totalMs += duration
  }
  return totalMs > 0 ? (totalTokens / totalMs) * 1000 : 0
}

export function formatTokenSpeed(tps: number): string {
  if (tps < 1) return "<1 tok/s"
  return `${Math.round(tps)} tok/s`
}

export function estimateStreamingSpeed(
  text: string,
  created: number,
  now: number,
  firstPartTime?: number,
): number {
  if (!text) return 0
  const start =
    firstPartTime !== undefined && firstPartTime > created ? firstPartTime : created
  const elapsed = (now - start) / 1000
  if (elapsed < 0.5) return 0
  const estimated = Math.max(1, Math.round(text.length / 4))
  return estimated / elapsed
}
