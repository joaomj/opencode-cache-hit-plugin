import { type CostDisplayConfig, normalizeCostDisplay, DEFAULT_COST_DISPLAY } from "./format-cost.ts"
import { resolveLang, type Lang } from "./i18n.ts"

export type DisplayConfig = {
  /** `en` | `zh` | `auto` (follow system locale). Default `en`. */
  lang: Lang | "auto"
  /** Optional override for the hit-rate line prefix (default from i18n). */
  mainHitLabel?: string
  /** Outer panel border (visual-cache style). Default true. */
  panelBorder: boolean
  /** @deprecated Use panelBorder */
  agentsBorder?: boolean
  /** Show token speed section. Default true. */
  showSpeed: boolean
  /** Speed display unit. Default "tpot". */
  speedUnit: "tpot" | "tps"
}

export const DEFAULT_DISPLAY: DisplayConfig = {
  lang: "en",
  panelBorder: true,
  showSpeed: true,
  speedUnit: "tpot",
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

export type CacheTTLConfig = {
  enabled: boolean
  /** TTL per provider (or provider:model). Values like "5m", "1h", "30s". Falls back to built-in defaults. */
  providers: Record<string, string>
}

export const DEFAULT_CACHE_TTL: CacheTTLConfig = {
  enabled: true,
  providers: {},
}

export type PluginConfig = {
  cost: CostDisplayConfig
  display: DisplayConfig
  timeline: TimelineConfig
  cacheTTL: CacheTTLConfig
}

export const DEFAULT_PLUGIN_CONFIG: PluginConfig = {
  cost: { ...DEFAULT_COST_DISPLAY },
  display: { ...DEFAULT_DISPLAY },
  timeline: { ...DEFAULT_TIMELINE },
  cacheTTL: { ...DEFAULT_CACHE_TTL },
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
  else if (typeof o.agentsBorder === "boolean") d.panelBorder = o.agentsBorder
  if (typeof o.showSpeed === "boolean") d.showSpeed = o.showSpeed
  if (o.speedUnit === "tps" || o.speedUnit === "tpot") d.speedUnit = o.speedUnit
  return d
}

export function normalizeCacheTTLConfig(raw: unknown): CacheTTLConfig {
  const t = structuredClone(DEFAULT_CACHE_TTL)
  if (!raw || typeof raw !== "object") return t
  const o = raw as Record<string, unknown>
  if (typeof o.enabled === "boolean") t.enabled = o.enabled
  if (o.providers && typeof o.providers === "object") {
    const providers = o.providers as Record<string, unknown>
    for (const [key, value] of Object.entries(providers)) {
      if (typeof value === "string") {
        t.providers[key] = value
      }
    }
  }
  return t
}

const TIME_UNITS: Record<string, number> = {
  s: 1000,
  sec: 1000,
  second: 1000,
  seconds: 1000,
  m: 60_000,
  min: 60_000,
  minute: 60_000,
  minutes: 60_000,
  h: 3_600_000,
  hr: 3_600_000,
  hour: 3_600_000,
  hours: 3_600_000,
}

export function parseDuration(raw: string): number | null {
  const match = raw.trim().match(/^(\d+(?:\.\d+)?)\s*([a-z]+)$/i)
  if (!match) {
    const num = Number(raw)
    return Number.isFinite(num) && num > 0 ? Math.floor(num) : null
  }
  const value = Number(match[1])
  const unit = match[2].toLowerCase()
  const multiplier = TIME_UNITS[unit]
  if (!multiplier || !Number.isFinite(value) || value <= 0) return null
  return Math.floor(value * multiplier)
}

export function normalizePluginConfig(raw: unknown): PluginConfig {
  if (!raw || typeof raw !== "object") return structuredClone(DEFAULT_PLUGIN_CONFIG)
  const o = raw as Record<string, unknown>
  const cost = normalizeCostDisplay(raw)
  const displayRaw = o.display
  return {
    cost,
    display: normalizeDisplayConfig(displayRaw),
    timeline: normalizeTimelineConfig(o.timeline),
    cacheTTL: normalizeCacheTTLConfig(o.cacheTTL),
  }
}
