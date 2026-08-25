import type { AssistantMessage, SessionObject, SessionSnapshot } from "./types.ts"

export function mainSessionHasStats(main: SessionSnapshot): boolean {
  return (
    main.cacheRead > 0 ||
    main.cacheWrite > 0 ||
    main.input > 0 ||
    main.output > 0
  )
}

export function emptySessionSnapshot(): SessionSnapshot {
  return { input: 0, output: 0, reasoning: 0, cacheRead: 0, cacheWrite: 0 }
}

export function aggregateFromSessionObject(session: SessionObject): SessionSnapshot {
  const t = session.tokens
  const c = t?.cache
  return {
    input: t?.input ?? 0,
    output: t?.output ?? 0,
    reasoning: t?.reasoning ?? 0,
    cacheRead: c?.read ?? 0,
    cacheWrite: c?.write ?? 0,
  }
}

export function aggregateSessionFromMessages(messages: readonly AssistantMessage[]): SessionSnapshot {
  let input = 0,
    output = 0,
    reasoning = 0,
    cacheRead = 0,
    cacheWrite = 0
  for (const msg of messages) {
    if (msg.role !== "assistant") continue
    const t = msg.tokens ?? {}
    input += t.input ?? 0
    output += t.output ?? 0
    reasoning += t.reasoning ?? 0
    cacheRead += t.cache?.read ?? 0
    cacheWrite += t.cache?.write ?? 0
  }
  return { input, output, reasoning, cacheRead, cacheWrite }
}

export function cacheHitRatio(cacheRead: number, input: number): number {
  const denom = cacheRead + input
  return denom > 0 ? cacheRead / denom : 0
}

/** Single assistant turn hit % (0–100), or null if skipped / no denominator. */
export function perMessageHitPercent(msg: AssistantMessage): number | null {
  if (msg.role !== "assistant" || msg.summary === true) return null
  const t = msg.tokens
  if (!t) return null
  const input = t.input ?? 0
  const read = t.cache?.read ?? 0
  const denom = read + input
  if (denom <= 0) return null
  return (read / denom) * 100
}
