/** Single LLM call row (one JSONL line). */
export type LlmCallRecord = {
  schema: 1
  recordedAt: number
  sessionId: string
  rootSessionId: string
  scope: "main" | "child"
  messageKey: string
  modelId: string
  created: number
  completedAt?: number
  durationMs?: number
  isComplete: boolean
  input: number
  output: number
  reasoning: number
  cacheRead: number
  cacheWrite: number
  cost: number
  hitPercent: number | null
  skippedForHit: boolean
}
