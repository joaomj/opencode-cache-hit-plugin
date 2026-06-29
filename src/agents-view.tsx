/** @jsxImportSource @opentui/solid */
import { For, Show } from "solid-js"
import { TokenDetailRows } from "./cache-hit-rows.tsx"
import type { CacheHitMetrics } from "./use-cache-hit-metrics.ts"
import { aggregateSubAgents } from "./stats.ts"
import { computeSubsSaved } from "./pricing.ts"
import { formatTokenCount } from "./format-tokens.ts"
import { formatSubAgentLabel, modelRowColor } from "./format-model.ts"
import { TuiMetricRow, type PanelLayout } from "./tui-panel/index.ts"
import type { ProviderInfo, SubAgentSummary } from "./types.ts"

function subHasActivity(sub: SubAgentSummary): boolean {
  return sub.cost > 0 || sub.cacheRead > 0 || sub.cacheWrite > 0 || sub.input > 0
}

export function AgentsView(props: {
  m: CacheHitMetrics
  layout: PanelLayout
  providers: ReadonlyArray<ProviderInfo>
  formatCost: (n: number) => string
  formatSpeed: (v: number | undefined) => string
}) {
  const { m, layout } = props
  const total = () => aggregateSubAgents(m.subs())

  const subsSaved = () => computeSubsSaved(m.subs(), props.providers)

  return (
    <>
      <TokenDetailRows pal={m.pal()} layout={layout} t={m.t()} snap={total()}>
        <Show when={subsSaved() > 0}>
          <TuiMetricRow
            pal={m.pal()}
            layout={layout}
            label={m.t().saved}
            value={props.formatCost(subsSaved())}
            fg={m.pal().success}
          />
        </Show>
      </TokenDetailRows>
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
              label={
                "  " +
                formatSubAgentLabel(sub, layout.gauge(), props.formatCost, m.t().tok)
              }
              value={sub.cost > 0 ? props.formatCost(sub.cost) : formatTokenCount(sub.input)}
              unit={sub.cost > 0 ? "" : m.t().tok}
              labelFg={modelRowColor(sub.model, sub.providerID, m.pal())}
              valueFg={m.pal().muted}
            />
            <Show when={sub.speed !== undefined}>
              <TuiMetricRow
                pal={m.pal()}
                layout={layout}
                label="    "
                value={props.formatSpeed(sub.speed)}
                fg={m.pal().muted}
              />
            </Show>
          </Show>
        )}
      </For>
    </>
  )
}
