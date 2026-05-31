/** deltaPercent: change in hit % points. Visual-cache trendLabel (0 → "-"). */
export function formatTrendLabel(deltaPercent: number): string {
  const t = deltaPercent
  return (t > 0 ? "\u2191" : t < 0 ? "\u2193" : "-") + (t !== 0 ? Math.abs(t).toFixed(1) + "%" : "")
}

/** One decimal place, e.g. 98.8% */
export function formatPercentOneDecimal(percent0to100: number): string {
  return (Math.floor(percent0to100 * 10) / 10).toFixed(1) + "%"
}

export function formatRatioAsPercent(ratio0to1: number): string {
  return formatPercentOneDecimal(ratio0to1 * 100)
}

/** Block chars only — wrap with `[` `]` in UI. */
export function formatHitBar(ratio: number, width = 16): string {
  const filled = Math.max(0, Math.min(width, Math.round(ratio * width)))
  const empty = Math.max(0, width - filled)
  return "\u2588".repeat(filled) + "\u2591".repeat(empty)
}
