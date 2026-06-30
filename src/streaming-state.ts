import type { AssistantMessage } from "./types.ts"
import { estimateStreamingSpeed, formatTokenSpeed, formatTokenTpot } from "./token-speed.ts"
import { STREAM_PART_TYPES } from "./first-part-time.ts"

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
  useTps = false,
): { value: string; tone: StreamingNowTone } {
  const format = useTps
    ? (spd: number | undefined) =>
        spd !== undefined && spd > 0 ? formatTokenSpeed(spd) : "—"
    : (spd: number | undefined) =>
        formatTokenTpot(spd !== undefined && spd > 0 ? 1000 / spd : undefined)

  const prefixEstimate = (val: string) =>
    val !== "—" && !val.startsWith("<") ? "~" : ""

  switch (phase) {
    case "idle":
      return { value: idleLabel, tone: "idle" }
    case "warmup":
      return { value: format(undefined), tone: "live" }
    case "active": {
      const val = format(speed > 0 ? speed : undefined)
      return { value: prefixEstimate(val) + val, tone: "live" }
    }
    case "hold": {
      const val = format(speed > 0 ? speed : undefined)
      return { value: prefixEstimate(val) + val, tone: "fading" }
    }
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
    .filter((p) => STREAM_PART_TYPES.has(p.type))
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
  // Only extend hold window on the first tick after in-flight ends (wasInFlight=true → false
  // transition). Subsequent idle ticks keep prev.holdUntil so the window doesn't drift.
  // If the stream restarts (wasInFlight becomes true again), holdUntil resets to 0 (see
  // in-flight branch above), so there is no stale window from the previous generation.
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
