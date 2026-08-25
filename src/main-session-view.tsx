/** @jsxImportSource @opentui/solid */
import { TuiHitRow, TuiMetricRow, TuiSection, type PanelLayout, type SectionFold } from "./tui-panel/index.ts"
import { TokenDetailRows } from "./cache-hit-rows.tsx"
import type { CacheHitMetrics } from "./use-cache-hit-metrics.ts"

export function MainSessionView(props: {
  m: CacheHitMetrics
  layout: PanelLayout
  detail: SectionFold
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
      />
      <TuiMetricRow pal={m.pal()} layout={layout} label={m.t().speed} value={m.speedLabel()} />
      <TuiSection
        pal={m.pal()}
        layout={layout}
        open={props.detail.open()}
        title={m.t().secDetail}
        onToggle={props.detail.toggle}
      >
        <TokenDetailRows pal={m.pal()} layout={layout} t={m.t()} snap={m.main()} />
      </TuiSection>
    </>
  )
}
