import { createMemo, type Accessor } from "solid-js"
import type { DisplayConfig } from "./plugin-config.ts"
import { getUiStrings, resolveLang } from "./i18n.ts"
import { formatHitBar, formatPercentOneDecimal, formatRatioAsPercent } from "./format-cache-ui.ts"
import { computeHitBarWidth, visualWidth } from "./tui-panel/layout.ts"
import { buildPanelPalette, type PanelPalette } from "./tui-panel/palette.ts"
import type { PanelLayout } from "./tui-panel/use-panel-layout.ts"
import type { SessionSnapshot } from "./types.ts"
import { cacheHitRatio, emptySessionSnapshot, mainSessionHasStats } from "./stats.ts"
import { computeSessionSpeed, type SessionSpeedTotals } from "./session-metrics.ts"
import { formatTokenSpeed } from "./token-speed.ts"

function activeLang(display: DisplayConfig) {
  return display.lang === "auto" ? resolveLang("auto") : display.lang
}

function hitRateColor(pct: number, pal: PanelPalette): string {
  if (pct >= 85) return pal.success
  if (pct >= 70) return pal.warning
  return pal.muted
}

export function useCacheHitMetrics(props: {
  theme: Accessor<Record<string, unknown>>
  display: DisplayConfig
  main: Accessor<SessionSnapshot>
  speed: Accessor<SessionSpeedTotals>
  layout: PanelLayout
}) {
  const pal = createMemo(() => buildPanelPalette(props.theme()))
  const t = createMemo(() => getUiStrings(activeLang(props.display)))
  const hitLabel = createMemo(() => props.display.mainHitLabel ?? t().hit)
  const main = createMemo(() => props.main() ?? emptySessionSnapshot())
  const sessionRatio = createMemo(() => cacheHitRatio(main().cacheRead, main().input))
  const sessionPercent = createMemo(() => sessionRatio() * 100)
  const speed = createMemo(() => computeSessionSpeed(props.speed()))
  const speedLabel = createMemo(() => formatTokenSpeed(speed()))
  const mainHasStats = createMemo(() => mainSessionHasStats(main()))
  const hasData = createMemo(() => mainHasStats())
  const bar = createMemo(() =>
    formatHitBar(
      sessionRatio(),
      computeHitBarWidth(hitLabel(), props.layout.gauge()),
    ),
  )
  const hitColor = createMemo(() => hitRateColor(sessionPercent(), pal()))
  const collapsedHitSummary = createMemo(() => {
    const text = `${formatPercentOneDecimal(sessionPercent())} ${t().hitFolded}`
    return { text, width: visualWidth(text) }
  })

  return {
    pal,
    t,
    main,
    mainHasStats,
    hasData,
    hitLabel,
    bar,
    hitColor,
    pctLabel: createMemo(() => formatPercentOneDecimal(sessionPercent())),
    sessionPct: createMemo(() => formatRatioAsPercent(sessionRatio())),
    speedLabel,
    collapsedHitSummary,
  }
}

export type CacheHitMetrics = ReturnType<typeof useCacheHitMetrics>
