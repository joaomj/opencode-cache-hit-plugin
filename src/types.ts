export type SessionSnapshot = {
  model: string
  input: number
  output: number
  reasoning: number
  cacheRead: number
  cacheWrite: number
  cost: number
}

export type SubAgentSummary = {
  id: string
  cost: number
  input: number
  output: number
  reasoning: number
  cacheRead: number
  cacheWrite: number
}

export type AssistantMessage = {
  role?: string
  id?: string
  messageID?: string
  modelID?: string
  cost?: number
  /** OpenCode SDK: true = summary/compaction message, not a full LLM pricing turn */
  summary?: boolean
  time?: {
    created: number
    completed?: number
  }
  tokens?: {
    input?: number
    output?: number
    reasoning?: number
    cache?: { read?: number; write?: number }
  }
}

export type OpenCodeTuiApi = {
  state: {
    path: { directory: string }
    session: {
      messages: (id: string) => unknown[] | undefined
      get: (id: string) => { parentID?: string } | undefined
    }
  }
  client: {
    session: {
      list: (opts: { query: { directory: string } }) => Promise<unknown>
    }
  }
  event: {
    on: (
      name: string,
      fn: (event: { properties?: { info?: { sessionID?: string } } }) => void,
    ) => () => void
  }
  slots: {
    register: (opts: {
      order: number
      slots: {
        sidebar_content: (
          ctx: { theme: { current: Record<string, unknown> } },
          props: { session_id: string },
        ) => unknown
      }
    }) => void
  }
}
