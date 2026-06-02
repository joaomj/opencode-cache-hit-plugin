import { formatTokenCount } from "./format-tokens.ts"
import { shortModelName } from "./stats.ts"
import type { PanelPalette } from "./tui-panel/palette.ts"
import { toneBrandHex } from "./tui-panel/palette.ts"
import { UNIT_GAP, truncateVisual, visualWidth } from "./tui-panel/layout.ts"
import type { SubAgentSummary } from "./types.ts"

const INDENT_COLS = 2
const MIN_ROW_GAP = 1
const MIN_LABEL_BUDGET = 6
const ID_TAIL_DEFAULT = 6
const ID_TAIL_MIN = 4

export type ModelFamilyId =
  | "claude"
  | "deepseek"
  | "openai"
  | "gemini"
  | "qwen"
  | "glm"
  | "kimi"
  | "minimax"
  | "grok"
  | "mimo"
  | "meta"
  | "mistral"

/**
 * Approximate vendor brand colors (pre-toning). Tuned for recognition on dark terminals.
 * Applied via `toneBrandHex` — not the panel semantic keys (`warning`, `primary`, …).
 */
export const MODEL_BRAND_HEX: Record<ModelFamilyId, string> = {
  claude: "#D4A574",
  deepseek: "#4D6BFE",
  openai: "#10A37F",
  gemini: "#5B8DEF",
  qwen: "#6157E5",
  glm: "#2F67F6",
  kimi: "#5B8FF9",
  minimax: "#FF6B35",
  grok: "#A8ADB8",
  mimo: "#7C6FE8",
  meta: "#0668E1",
  mistral: "#FF8200",
}

/** Fallback hues for unknown providers (also toned; never panel `success` green). */
const UNKNOWN_BRAND_HEX = ["#8B9DAF", "#9CAF8B", "#A89BBF", "#B0A080"] as const

type ModelFamilyRule = {
  id: ModelFamilyId
  match: (name: string, providerID: string) => boolean
}

/**
 * Built-in model/provider families (label stays full `displayModelName`).
 * First match wins — order from more specific vendor slugs to broad prefixes.
 */
export const MODEL_FAMILY_RULES: readonly ModelFamilyRule[] = [
  {
    id: "claude",
    match: (n, p) =>
      p === "anthropic" ||
      n.startsWith("claude-") ||
      /(^|-)(sonnet|opus|haiku)(-|$)/i.test(n),
  },
  {
    id: "deepseek",
    match: (n, p) => p === "deepseek" || n.startsWith("deepseek-"),
  },
  {
    id: "openai",
    match: (n, p) =>
      p === "openai" ||
      n.startsWith("gpt-") ||
      /^o[13](-|$)/.test(n) ||
      n.startsWith("chatgpt-"),
  },
  {
    id: "gemini",
    match: (n, p) => p === "google" || n.startsWith("gemini-"),
  },
  {
    id: "qwen",
    match: (n, p) => p === "qwen" || p === "alibaba" || n.startsWith("qwen"),
  },
  {
    id: "glm",
    match: (n, p) =>
      p === "zhipu" ||
      p === "zhipuai" ||
      n.startsWith("glm-") ||
      n.includes("chatglm"),
  },
  {
    id: "kimi",
    match: (n, p) => p === "moonshot" || n.startsWith("kimi-"),
  },
  {
    id: "minimax",
    match: (n, p) => p === "minimax" || n.startsWith("minimax"),
  },
  {
    id: "grok",
    match: (n, p) => p === "x-ai" || p === "xai" || n.startsWith("grok-"),
  },
  {
    id: "mimo",
    match: (n, p) => p === "mimo" || n.startsWith("mimo-"),
  },
  {
    id: "meta",
    match: (n, p) => p === "meta" || n.startsWith("llama-") || n.includes("meta-llama"),
  },
  {
    id: "mistral",
    match: (n, p) => p === "mistral" || n.startsWith("mistral-") || n.startsWith("codestral-"),
  },
]

/** Strip release-date tails only — same spirit as main-session `modelShort`. */
export function stripModelDateSuffix(name: string): string {
  return name.replace(/-20\d{6,}$/, "").replace(/-\d{8}$/, "")
}

/** Sub-agent label text: `shortModelName` + date trim; row layout truncates visually. */
export function displayModelName(modelId: string): string {
  const name = shortModelName(modelId)
  if (!name) return ""
  return stripModelDateSuffix(name)
}

/** @deprecated alias */
export function compactModelLabel(modelId: string, _providerID = ""): string {
  return displayModelName(modelId)
}

function normalizeForFamilyMatch(s: string): string {
  return s.toLowerCase()
}

function findFamilyRule(name: string, providerID: string): ModelFamilyRule | undefined {
  const n = normalizeForFamilyMatch(name)
  const p = normalizeForFamilyMatch(providerID)
  return MODEL_FAMILY_RULES.find((r) => r.match(n, p))
}

export function modelFamilyId(modelId: string, providerID: string): ModelFamilyId | null {
  const name = shortModelName(modelId)
  if (!name) return null
  return findFamilyRule(name, providerID)?.id ?? null
}

function stableHash(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i)
  return h >>> 0
}

/** Sub-agent label color from vendor brand hex (toned for TUI). */
export function modelRowColor(modelId: string, providerID: string, pal: PanelPalette): string {
  const fallback = pal.muted
  const family = modelFamilyId(modelId, providerID)
  if (family) return toneBrandHex(MODEL_BRAND_HEX[family], fallback)
  const name = shortModelName(modelId)
  const key = providerID || name.split("-")[0] || name
  const idx = stableHash(key) % UNKNOWN_BRAND_HEX.length
  return toneBrandHex(UNKNOWN_BRAND_HEX[idx]!, fallback)
}

export function sessionIdTail(id: string, tailLen: number): string {
  if (!id) return ""
  if (id.length <= tailLen) return id
  return "\u2026" + id.slice(-tailLen)
}

export function subAgentLabelBudget(gauge: number, value: string, unit: string): number {
  const rightW = visualWidth(value) + (unit ? visualWidth(unit) + UNIT_GAP : 0)
  return Math.max(MIN_LABEL_BUDGET, gauge - rightW - INDENT_COLS - MIN_ROW_GAP)
}

/** Sub-agent label: `{model} …{idTail}` — model first; truncation keeps model prefix. */
export function formatSubAgentLabel(
  sub: SubAgentSummary,
  gauge: number,
  formatCost: (n: number) => string,
  tokUnit: string,
): string {
  const value = sub.cost > 0 ? formatCost(sub.cost) : formatTokenCount(sub.input)
  const unit = sub.cost > 0 ? "" : tokUnit
  const budget = subAgentLabelBudget(gauge, value, unit)

  if (!shortModelName(sub.model)) {
    return truncateVisual(sessionIdTail(sub.id, ID_TAIL_DEFAULT), budget)
  }

  const model = displayModelName(sub.model)
  return joinModelAndSessionId(model, sub.id, budget)
}

function joinModelAndSessionId(model: string, id: string, budget: number): string {
  if (!model) {
    return truncateVisual(sessionIdTail(id, ID_TAIL_DEFAULT), budget)
  }

  const tryPair = (tailLen: number, trimModel: boolean): string | null => {
    const idPart = sessionIdTail(id, tailLen)
    const idBlockW = visualWidth(idPart) + 1
    if (budget <= idBlockW) return null
    const modelPart = trimModel ? truncateVisual(model, budget - idBlockW) : model
    if (!modelPart) return null
    const combined = modelPart + " " + idPart
    return visualWidth(combined) <= budget ? combined : null
  }

  for (const tailLen of [ID_TAIL_DEFAULT, ID_TAIL_MIN]) {
    const full = tryPair(tailLen, false)
    if (full) return full
  }

  for (const tailLen of [ID_TAIL_MIN, ID_TAIL_DEFAULT]) {
    const trimmed = tryPair(tailLen, true)
    if (trimmed) return trimmed
  }

  return truncateVisual(model, budget)
}
