import { createMemo, type Accessor } from "solid-js"
import type { DisplayConfig } from "./plugin-config.ts"
import { getUiStrings, resolveLang } from "./i18n.ts"
import {
  formatHitBar,
  formatPercentOneDecimal,
  formatRatioAsPercent,
  formatTrendLabel,
} from "./format-cache-ui.ts"
import { computeHitBarWidth, visualWidth } from "./tui-panel/layout.ts"
import { buildPanelPalette, type PanelPalette } from "./tui-panel/palette.ts"
import type { PanelLayout } from "./tui-panel/use-panel-layout.ts"
import type { AssistantMessage, ProviderInfo, SessionSnapshot, SubAgentSummary } from "./types.ts"
import {
  cacheHitRatio,
  computePerCallHitTrend,
  mainSessionHasStats,
  shortModelName,
} from "./stats.ts"
import { computePricing, type PricingInfo } from "./pricing.ts"
import { computeAvgTokenSpeed, computeTokenSpeed, formatTokenSpeed } from "./token-speed.ts"
import { timingFromAssistantMessage } from "./message-timing.ts"
import { formatSparkline, collectSpeedValues } from "./sparkline.ts"

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
  messages: Accessor<AssistantMessage[]>
  main: Accessor<SessionSnapshot>
  subAgents: Accessor<SubAgentSummary[]>
  providers: Accessor<ReadonlyArray<ProviderInfo>>
  layout: PanelLayout
}) {
  const pal = createMemo(() => buildPanelPalette(props.theme()))
  const t = createMemo(() => getUiStrings(activeLang(props.display)))
  const hitLabel = createMemo(() => props.display.mainHitLabel ?? t().hit)
  const subs = createMemo(() => props.subAgents())
  const main = createMemo(() => props.main())
  const perCall = createMemo(() => computePerCallHitTrend(props.messages()))
  const sessionRatio = createMemo(() => cacheHitRatio(main().cacheRead, main().input))

  const pricing = createMemo<PricingInfo>(() =>
    computePricing(props.providers(), main().providerID, main().model, main().cacheRead),
  )

  const mainHasStats = createMemo(() => mainSessionHasStats(main()))
  const hasData = createMemo(() => mainHasStats() || subs().length > 0)

  const trendLabel = createMemo(() =>
    perCall().hasTrend ? formatTrendLabel(perCall().trendPercent) : "",
  )
  const bar = createMemo(() =>
    formatHitBar(
      perCall().hitPercent / 100,
      computeHitBarWidth(hitLabel(), props.layout.gauge(), trendLabel(), perCall().hasTrend),
    ),
  )
  const hitColor = createMemo(() => hitRateColor(perCall().hitPercent, pal()))
  const trendFg = createMemo(() => {
    const tr = perCall().trendPercent
    if (Math.abs(tr) < 0.05) return pal().text
    return tr > 0 ? pal().success : pal().error
  })

  const collapsedHitSummary = createMemo(() => {
    const right = perCall().hasTrend
      ? `${formatPercentOneDecimal(perCall().hitPercent)} ${t().hitFolded} ${trendLabel()}`
      : `${formatPercentOneDecimal(perCall().hitPercent)} ${t().hitFolded}`
    return { text: right, width: visualWidth(right) }
  })

  const lastSpeed = createMemo(() => {
    const msgs = props.messages()
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].summary) continue
      const timing = timingFromAssistantMessage(msgs[i])
      if (!timing?.isComplete || timing.durationMs === undefined) continue
      const output = msgs[i].tokens?.output ?? 0
      const reasoning = msgs[i].tokens?.reasoning ?? 0
      if (output + reasoning === 0) continue
      return computeTokenSpeed(output, reasoning, timing.durationMs)
    }
    return 0
  })

  const avgSpeed = createMemo(() => computeAvgTokenSpeed(props.messages()))

  const speedValues = createMemo(() => {
    const msgs = props.messages()
    const records = msgs
      .filter((msg) => msg.role === "assistant" && !msg.summary && msg.time?.completed)
      .map((msg) => {
        const timing = timingFromAssistantMessage(msg)
        return {
          durationMs: timing?.durationMs,
          output: (msg.tokens?.output ?? 0) + (msg.tokens?.reasoning ?? 0),
        }
      })
    return collectSpeedValues(records)
  })

  const sparkline = createMemo(() => formatSparkline(speedValues()))

  return {
    pal,
    t,
    hitLabel,
    subs,
    main,
    mainHasStats,
    perCall,
    pricing,
    sessionPct: createMemo(() => formatRatioAsPercent(sessionRatio())),

    hasData,
    trendLabel,
    bar,
    hitColor,
    trendFg,
    pctLabel: createMemo(() => formatPercentOneDecimal(perCall().hitPercent)),
    modelShort: createMemo(() => shortModelName(main().model)),
    totalSubCost: createMemo(() => subs().reduce((s, a) => s + a.cost, 0)),
    collapsedHitSummary,
    lastSpeed,
    lastSpeedLabel: createMemo(() => formatTokenSpeed(lastSpeed())),
    avgSpeed,
    avgSpeedLabel: createMemo(() => formatTokenSpeed(avgSpeed())),
    sparkline,
  }
}

export type CacheHitMetrics = ReturnType<typeof useCacheHitMetrics>
