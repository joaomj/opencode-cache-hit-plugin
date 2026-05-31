/** @jsxImportSource @opentui/solid */
import { Show } from "solid-js"
import { TokenDetailRows } from "./cache-hit-rows.tsx"
import type { CacheHitMetrics } from "./use-cache-hit-metrics.ts"
import {
  TuiHitRow,
  TuiMetricRow,
  TuiSection,
  type PanelLayout,
  type SectionFold,
} from "./tui-panel/index.ts"

export function MainSessionView(props: {
  m: CacheHitMetrics
  layout: PanelLayout
  detail: SectionFold
  model: SectionFold
  formatCost: (n: number) => string
}) {
  const { m, layout } = props
  return (
    <>
      <TuiHitRow
        label={m.hitLabel()}
        bar={m.bar()}
        pct={m.pctLabel()}
        barColor={m.hitColor()}
        textColor={m.pal().text}
        trend={
          m.perCall().hasTrend ? { text: m.trendLabel(), color: m.trendFg() } : undefined
        }
      />
      <TuiMetricRow pal={m.pal()} layout={layout} label={m.t().totalHit} value={m.sessionPct()} />

      <TuiSection
        pal={m.pal()}
        layout={layout}
        open={props.detail.open()}
        title={m.t().secDetail}
        onToggle={props.detail.toggle}
      >
        <TokenDetailRows pal={m.pal()} layout={layout} t={m.t()} snap={m.main()}>
          <Show when={m.showCombinedHit()}>
            <TuiMetricRow
              pal={m.pal()}
              layout={layout}
              label={m.t().withAgents}
              value={m.combinedPct()}
            />
          </Show>
        </TokenDetailRows>
      </TuiSection>

      <TuiSection
        pal={m.pal()}
        layout={layout}
        open={props.model.open()}
        title={m.t().secModel}
        onToggle={props.model.toggle}
      >
        <Show when={m.main().cost > 0}>
          <TuiMetricRow
            pal={m.pal()}
            layout={layout}
            label={m.t().cost}
            value={props.formatCost(m.main().cost)}
            fg={m.pal().text}
          />
        </Show>
        <Show when={m.modelShort()}>
          <TuiMetricRow pal={m.pal()} layout={layout} label={m.t().model} value={m.modelShort()} />
        </Show>
      </TuiSection>
    </>
  )
}
