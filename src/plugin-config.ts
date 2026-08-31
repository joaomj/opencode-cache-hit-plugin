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

export type PluginConfig = {
  display: DisplayConfig
}

export const DEFAULT_PLUGIN_CONFIG: PluginConfig = {
  display: { ...DEFAULT_DISPLAY },
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
  }
}
