/** Terminal layout primitives (visual-width aware, opencode-visual-cache compatible). */

export const MIN_PANEL_WIDTH = 20
export const DEFAULT_PANEL_WIDTH = 28
export const PANEL_GUTTER = 6
export const UNIT_GAP = 1
export const HEADER_PREFIX = 2

export const HIT_LABEL_GAP = 1
export const HIT_BAR_BRACKETS = 2
export const HIT_BAR_GAP = 1
export const HIT_PCT_FIXED_WIDTH = 5

function charColumns(c: string): number {
  const code = c.codePointAt(0) ?? 0
  if (code < 0x20) return 0
  if (code < 0x7f) return 1
  if (code < 0xa0) return 0
  if (
    (code >= 0x1100 && code <= 0x115f) ||
    (code >= 0x2e80 && code <= 0xa4cf) ||
    (code >= 0xac00 && code <= 0xd7a3) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xfe10 && code <= 0xfe6f) ||
    (code >= 0xff01 && code <= 0xff60) ||
    (code >= 0xffe0 && code <= 0xffe6) ||
    (code >= 0x1f300 && code <= 0x1f64f) ||
    (code >= 0x20000 && code <= 0x3fffd)
  )
    return 2
  return 1
}

export function visualWidth(s: string): number {
  let w = 0
  for (const c of s) w += charColumns(c)
  return w
}

export function visualPadEnd(s: string, cols: number): string {
  const pad = cols - visualWidth(s)
  return pad > 0 ? s + " ".repeat(pad) : s
}

export function truncateVisual(s: string, maxCols: number): string {
  if (visualWidth(s) <= maxCols) return s
  let result = ""
  let w = 0
  for (const c of s) {
    const cw = charColumns(c)
    if (w + cw > maxCols - 1) {
      result += "\u2026"
      break
    }
    result += c
    w += cw
  }
  return result
}

export function computeHitBarWidth(
  hitLabel: string,
  rowWidth: number,
  trendText: string,
  showTrend: boolean,
): number {
  const trendSpace = showTrend ? HIT_LABEL_GAP + visualWidth(trendText) : 0
  const overhead =
    visualWidth(hitLabel) +
    HIT_LABEL_GAP +
    HIT_BAR_BRACKETS +
    HIT_BAR_GAP +
    HIT_PCT_FIXED_WIDTH +
    trendSpace
  return Math.max(3, rowWidth - overhead)
}

export function justifyEnds(label: string, right: string, rowWidth: number): string {
  const gap = Math.max(1, rowWidth - visualWidth(label) - visualWidth(right))
  return label + " ".repeat(gap) + right
}

export function justifyRow(label: string, value: string, rowWidth: number, unit = ""): string {
  const used =
    visualWidth(label) + visualWidth(value) + (unit ? visualWidth(unit) + UNIT_GAP : 0)
  const gap = Math.max(1, rowWidth - used)
  return label + " ".repeat(gap) + value + (unit ? " " + unit : "")
}

export function sepAfterPrefix(prefix: string, rowWidth: number): string {
  const rest = Math.max(1, rowWidth - visualWidth(prefix))
  return "\u2500".repeat(rest)
}

export function separatorLine(width = 28): string {
  return "\u2500".repeat(Math.max(8, width))
}

/** Spaces before right-aligned collapsed title summary. */
export function padBeforeTitleSummary(
  panelWidth: number,
  gutter: number,
  titleWidth: number,
  summaryWidth: number,
): number {
  return Math.max(1, panelWidth - gutter - HEADER_PREFIX - titleWidth - summaryWidth)
}
