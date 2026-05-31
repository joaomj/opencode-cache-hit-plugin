/** @jsxImportSource @opentui/solid */
import { For, Show } from "solid-js"
import { TokenDetailRows } from "./cache-hit-rows.tsx"
import type { CacheHitMetrics } from "./use-cache-hit-metrics.ts"
import { aggregateSubAgents } from "./stats.ts"
import { formatTokenCount } from "./format-tokens.ts"
import { TuiMetricRow, truncateVisual, type PanelLayout } from "./tui-panel/index.ts"
import type { SubAgentSummary } from "./types.ts"

function agentRowLabel(id: string, gauge: number): string {
  const tail = id.length > 10 ? id.slice(-8) : id
  const raw = id.length > 10 ? "\u2026" + tail : tail
  return truncateVisual(raw, Math.max(6, gauge - 14))
}

function subHasActivity(sub: SubAgentSummary): boolean {
  return sub.cost > 0 || sub.cacheRead > 0 || sub.cacheWrite > 0 || sub.input > 0
}

export function AgentsView(props: {
  m: CacheHitMetrics
  layout: PanelLayout
  formatCost: (n: number) => string
}) {
  const { m, layout } = props
  const total = () => aggregateSubAgents(m.subs())

  return (
    <>
      <TokenDetailRows pal={m.pal()} layout={layout} t={m.t()} snap={total()} />
      <Show when={total().cost > 0}>
        <TuiMetricRow
          pal={m.pal()}
          layout={layout}
          label={m.t().cost}
          value={props.formatCost(total().cost)}
          fg={m.pal().success}
        />
      </Show>
      <For each={m.subs()}>
        {(sub) => (
          <Show when={subHasActivity(sub)}>
            <TuiMetricRow
              pal={m.pal()}
              layout={layout}
              label={"  " + agentRowLabel(sub.id, layout.gauge())}
              value={sub.cost > 0 ? props.formatCost(sub.cost) : formatTokenCount(sub.input)}
              unit={sub.cost > 0 ? "" : m.t().tok}
            />
          </Show>
        )}
      </For>
    </>
  )
}
