import { resolveLang, type Lang } from "./i18n.ts"

export type DisplayConfig = {
  /** `en` | `auto` (use English labels). Default `en`. */
  lang: Lang | "auto"
  /** Optional override for the hit-rate line prefix (default from i18n). */
  mainHitLabel?: string
  /** Outer panel border (visual-cache style). Default true. */
  panelBorder: boolean
}

export const DEFAULT_DISPLAY: DisplayConfig = {
  lang: "en",
  panelBorder: true,
}

export type ToolSummaryConfig = {
  /** Default for tools not explicitly listed. Default true. */
  allTools: boolean
  /** Per-tool overrides. When present, overrides allTools for that tool. */
  bash?: boolean
  read?: boolean
  write?: boolean
  edit?: boolean
  grep?: boolean
  glob?: boolean
  webfetch?: boolean
  websearch?: boolean
  task?: boolean
  question?: boolean
}

export type ToolSummarySetting = boolean | ToolSummaryConfig

export type TimelineConfig = {
  enabled: boolean
  /** Empty → `~/.local/share/opencode/logs/cache-hit`. Supports `~/…` expansion. */
  dir: string
  flushIncomplete: boolean
  logSummaryMessages: boolean
  maxMemoryRows: number
  /** 0 = unlimited; after each append keep only the last N lines in the active file */
  maxLinesPerFile: number
  /** 0 = off; when active file reaches this size (bytes), roll to `.jsonl.1` before append */
  rotateMaxBytes: number
  /** How many rotated backups to keep (`file.jsonl.1` … `.N`); 0 = delete on roll */
  retainRotated: number
  /** 0 = off; delete `*.jsonl*` in log dir older than N days (on collector start) */
  maxAgeDays: number
  /** 0 = unlimited; max number of `*.jsonl*` files in log dir (oldest mtime deleted first) */
  maxLogFiles: number
  /**
   * Controls whether tool summaries (privacy-sensitive hints from tool input)
   * are recorded in JSONL `toolDurations[].summary`.
   *
   * - `true`  → all tools record summaries
   * - `false` → no summaries; only `tool` + `durationMs` are recorded
   * - `{ allTools, bash?, read?, ... }` → per-tool control
   *
   * Default `{ allTools: true, bash: false }`: secure-by-default — bash commands
   * may contain credentials, tokens, or file paths and are only truncated, not sanitized.
   */
  toolSummary: ToolSummarySetting
}

export const DEFAULT_TIMELINE: TimelineConfig = {
  enabled: false,
  dir: "",
  flushIncomplete: false,
  logSummaryMessages: true,
  maxMemoryRows: 50,
  maxLinesPerFile: 0,
  rotateMaxBytes: 0,
  retainRotated: 5,
  maxAgeDays: 0,
  maxLogFiles: 0,
  // Secure-by-default: bash summaries may leak credentials/tokens (only truncated, not sanitized).
  toolSummary: { allTools: true, bash: false },
}

export type PluginConfig = {
  display: DisplayConfig
  timeline: TimelineConfig
}

export const DEFAULT_PLUGIN_CONFIG: PluginConfig = {
  display: { ...DEFAULT_DISPLAY },
  timeline: { ...DEFAULT_TIMELINE },
}

const TOOL_SUMMARY_KEYS: ReadonlySet<string> = new Set([
  "allTools", "bash", "read", "write", "edit",
  "grep", "glob", "webfetch", "websearch", "task", "question",
])

function parseToolSummarySetting(raw: unknown): ToolSummarySetting {
  if (typeof raw === "boolean") return raw
  if (!raw || typeof raw !== "object") return true
  const o = raw as Record<string, unknown>
  const result: ToolSummaryConfig = { allTools: true }
  if (typeof o.allTools === "boolean") result.allTools = o.allTools
  for (const key of TOOL_SUMMARY_KEYS) {
    if (key === "allTools") continue
    if (typeof o[key] === "boolean") {
      ;(result as Record<string, boolean>)[key] = o[key] as boolean
    }
  }
  return result
}

export function isToolSummaryEnabled(setting: ToolSummarySetting, tool: string): boolean {
  if (typeof setting === "boolean") return setting
  const override = (setting as Record<string, boolean | undefined>)[tool]
  if (typeof override === "boolean") return override
  return setting.allTools
}

export function normalizeTimelineConfig(raw: unknown): TimelineConfig {
  const t = structuredClone(DEFAULT_TIMELINE)
  if (!raw || typeof raw !== "object") return t
  const o = raw as Record<string, unknown>
  if (typeof o.enabled === "boolean") t.enabled = o.enabled
  if (typeof o.dir === "string") t.dir = o.dir
  if (typeof o.flushIncomplete === "boolean") t.flushIncomplete = o.flushIncomplete
  if (typeof o.logSummaryMessages === "boolean") t.logSummaryMessages = o.logSummaryMessages
  if (typeof o.maxMemoryRows === "number" && o.maxMemoryRows > 0) {
    t.maxMemoryRows = Math.floor(o.maxMemoryRows)
  }
  if (typeof o.maxLinesPerFile === "number" && o.maxLinesPerFile >= 0) {
    t.maxLinesPerFile = Math.floor(o.maxLinesPerFile)
  }
  if (typeof o.rotateMaxBytes === "number" && o.rotateMaxBytes >= 0) {
    t.rotateMaxBytes = Math.floor(o.rotateMaxBytes)
  }
  if (typeof o.retainRotated === "number" && o.retainRotated >= 0) {
    t.retainRotated = Math.floor(o.retainRotated)
  }
  if (typeof o.maxAgeDays === "number" && o.maxAgeDays >= 0) {
    t.maxAgeDays = Math.floor(o.maxAgeDays)
  }
  if (typeof o.maxLogFiles === "number" && o.maxLogFiles >= 0) {
    t.maxLogFiles = Math.floor(o.maxLogFiles)
  }
  if (o.toolSummary !== undefined) {
    t.toolSummary = parseToolSummarySetting(o.toolSummary)
  }
  return t
}

export function normalizeDisplayConfig(raw: unknown): DisplayConfig {
  const d = structuredClone(DEFAULT_DISPLAY)
  if (!raw || typeof raw !== "object") return d
  const o = raw as Record<string, unknown>
  if (typeof o.lang === "string") {
    d.lang = o.lang === "auto" ? "auto" : resolveLang(o.lang)
  }
  if (typeof o.mainHitLabel === "string" && o.mainHitLabel.length > 0) d.mainHitLabel = o.mainHitLabel
  if (typeof o.panelBorder === "boolean") d.panelBorder = o.panelBorder
  return d
}

export function normalizePluginConfig(raw: unknown): PluginConfig {
  if (!raw || typeof raw !== "object") return structuredClone(DEFAULT_PLUGIN_CONFIG)
  const o = raw as Record<string, unknown>
  const displayRaw = o.display
  return {
    display: normalizeDisplayConfig(displayRaw),
    timeline: normalizeTimelineConfig(o.timeline),
  }
}
