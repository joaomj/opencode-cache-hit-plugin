/** Tracks per-tool call durations for timeline JSONL. */

type ToolTimingEntry = {
  tool: string
  callID: string
  summary?: string
  start?: number
  end?: number
  durationMs?: number
  status: "running" | "completed" | "error"
}

export type ToolDurationRecord = {
  tool: string
  summary?: string
  durationMs: number
}

export type ToolTimingTracker = {
  handleToolPart: (messageID: string, part: ToolPartEventData) => void
  getDurations: (messageID: string) => ToolDurationRecord[] | undefined
  reset: () => void
  dispose: () => void
}

export type ToolPartEventData = {
  type: string
  tool?: string
  callID?: string
  state?: {
    status?: string
    time?: { start?: number; end?: number }
    input?: Record<string, unknown>
  }
}

function strField(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined
}

function truncate(s: string, maxLen: number): string {
  return s.length > maxLen ? s.slice(0, maxLen - 3) + "..." : s
}

function basename(path: string): string {
  const sep = path.lastIndexOf("/")
  return sep >= 0 ? path.slice(sep + 1) : path
}

function stripUrlQuery(raw: string): string {
  const q = raw.indexOf("?")
  return q >= 0 ? raw.slice(0, q) : raw
}

function urlDomainPath(url: string): string {
  try {
    const u = new URL(url)
    return truncate(u.pathname ? u.hostname + u.pathname : u.hostname, 80)
  } catch {
    return truncate(stripUrlQuery(url), 80)
  }
}

function toolSummary(tool: string, input?: Record<string, unknown>): string | undefined {
  if (!input) return undefined
  if (tool === "bash") return truncate(strField(input.command) ?? "", 60) || undefined
  if (tool === "read" || tool === "write" || tool === "edit") {
    const fp = strField(input.filePath)
    return fp ? basename(fp) : undefined
  }
  if (tool === "grep" || tool === "glob") {
    const pattern = strField(input.pattern)
    return pattern ? truncate(pattern, 60) : undefined
  }
  if (tool === "webfetch") {
    const url = strField(input.url)
    return url ? urlDomainPath(url) : undefined
  }
  if (tool === "task") {
    const desc = strField(input.description)
    return desc ? truncate(desc, 60) : undefined
  }
  if (tool === "websearch") {
    const query = strField(input.query)
    return query ? truncate(query, 60) : undefined
  }
  if (tool === "lsp_diagnostics" || tool === "lsp_symbols" || tool === "lsp_find_references" || tool === "lsp_goto_definition") {
    const fp = strField(input.filePath)
    return fp ? basename(fp) : undefined
  }
  if (tool === "question") {
    const questions = input.questions
    if (!Array.isArray(questions) || questions.length === 0) return undefined
    const q = questions[0]
    if (!q || typeof q !== "object") return undefined
    const item = q as Record<string, unknown>
    const header = strField(item.header)
    if (header) return truncate(header, 60)
    const question = strField(item.question)
    return question ? truncate(question, 60) : undefined
  }
  return undefined
}

export function createToolTimingTracker(): ToolTimingTracker {
  let disposed = false
  const timing = new Map<string, ToolTimingEntry[]>()

  const handleToolPart = (messageID: string, part: ToolPartEventData) => {
    if (disposed || !messageID || part.type !== "tool") return
    if (!part.callID || !part.tool) return

    const state = part.state
    if (!state?.status) return

    const entries = timing.get(messageID) ?? []
    let entry = entries.find((e) => e.callID === part.callID)

    if (!entry) {
      entry = {
        tool: part.tool,
        callID: part.callID,
        summary: toolSummary(part.tool, state.input),
        status: "running",
      }
      entries.push(entry)
      timing.set(messageID, entries)
    }

    if (entry.summary === undefined && state.input) {
      entry.summary = toolSummary(part.tool, state.input)
    }

    if (state.status === "running" && entry.status === "running" && entry.start === undefined) {
      entry.start = state.time?.start ?? Date.now()
    }

    if ((state.status === "completed" || state.status === "error") && entry.status === "running") {
      if (entry.start === undefined && typeof state.time?.start === "number") {
        entry.start = state.time.start
      }
      entry.status = state.status
      entry.end = state.time?.end ?? Date.now()
      if (typeof entry.start === "number" && entry.end >= entry.start) {
        entry.durationMs = entry.end - entry.start
      }
    }
  }

  const getDurations = (messageID: string) => {
    const entries = timing.get(messageID)
    if (!entries?.length) return undefined
    const result = entries
      .filter((e) => e.durationMs !== undefined)
      .map((e) => ({ tool: e.tool, summary: e.summary, durationMs: e.durationMs! }))
    return result.length > 0 ? result : undefined
  }

  return {
    handleToolPart,
    getDurations,
    reset: () => timing.clear(),
    dispose: () => {
      disposed = true
      timing.clear()
    },
  }
}
