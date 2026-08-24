export type SessionSnapshot = {
  input: number
  output: number
  reasoning: number
  cacheRead: number
  cacheWrite: number
  cost: number
}

export type AssistantMessage = {
  role?: string
  id?: string
  messageID?: string
  cost?: number
  /** OpenCode SDK: true = summary/compaction message, not a full LLM turn */
  summary?: boolean
  finish?: string
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

export type StreamPart = {
  type: string
  text?: string
  time?: { start?: number }
}

export type PartUpdatedPart = {
  type: string
  messageID: string
  time?: { start?: number }
}

export function isPartUpdatedEvent(
  event: { properties?: Record<string, unknown> },
): event is { properties: { part: PartUpdatedPart } } {
  const p = event.properties?.part
  return (
    typeof p === "object" &&
    p !== null &&
    typeof (p as Record<string, unknown>).type === "string" &&
    typeof (p as Record<string, unknown>).messageID === "string"
  )
}

/** Session aggregate from `api.state.session.get()` — DB-level totals, not capped by message limit. */
export type SessionObject = {
  cost?: number
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
      get?: (id: string) => SessionObject | undefined
    }
    part: (messageID: string) => ReadonlyArray<StreamPart> | undefined
  }
  client: {
    session: {
      messages?: (opts: {
        path: { id: string }
        query: { directory: string; limit: number }
      }) => Promise<unknown>
    }
  }
  event: {
    on: (
      name: string,
      fn: (event: { properties?: Record<string, unknown> }) => void,
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
