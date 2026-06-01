/** Single LLM call row (one JSONL line). */
export type LlmCallRecord = {
  schema: 1
  recordedAt: string
  sessionId: string
  rootSessionId: string
  scope: "main" | "child"
  messageKey: string
  modelId: string
  created: string
  completedAt?: string
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
