import type { AssistantMessage } from "./types.ts"

export function computeTokenSpeed(output: number, reasoning: number, durationMs: number): number {
  if (durationMs < 500) return 0
  return ((output + reasoning) / durationMs) * 1000
}

export function computeAvgTokenSpeed(messages: AssistantMessage[]): number {
  let totalTokens = 0
  let totalMs = 0
  for (const msg of messages) {
    if (msg.summary) continue
    if (!msg.time?.completed) continue
    const output = msg.tokens?.output ?? 0
    const reasoning = msg.tokens?.reasoning ?? 0
    if (output + reasoning === 0) continue
    const duration = msg.time.completed - msg.time.created
    if (duration < 500) continue
    totalTokens += output + reasoning
    totalMs += duration
  }
  return totalMs > 0 ? (totalTokens / totalMs) * 1000 : 0
}

export function formatTokenSpeed(tps: number): string {
  if (tps < 1) return "<1 tok/s"
  return `${Math.round(tps)} tok/s`
}

export function estimateStreamingSpeed(text: string, created: number, now: number): number {
  if (!text) return 0
  const elapsed = (now - created) / 1000
  if (elapsed < 0.5) return 0
  const estimated = Math.max(1, Math.round(text.length / 4))
  return estimated / elapsed
}
