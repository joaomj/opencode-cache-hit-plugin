/** @jsxImportSource @opentui/solid */
import { createSignal, Show, type Accessor } from "solid-js"
import type { DisplayConfig } from "./plugin-config.ts"
import type { SessionSnapshot } from "./types.ts"
import type { SessionSpeedTotals } from "./session-metrics.ts"
import { PLUGIN_VERSION } from "./version.ts"
import { MainSessionView } from "./main-session-view.tsx"
import { useCacheHitMetrics } from "./use-cache-hit-metrics.ts"
import {
  createPanelLayout,
  createSectionFold,
  TuiPanel,
  TuiPanelNoData,
  TuiPanelSep,
  TuiPanelTitle,
  TuiTitleSummaryPad,
  visualWidth,
} from "./tui-panel/index.ts"

export function CacheHitSidebar(props: {
  sessionId: Accessor<string>
  theme: Record<string, unknown>
  display: DisplayConfig
  main: Accessor<SessionSnapshot>
  speed: Accessor<SessionSpeedTotals>
  formatCost: (amount: number) => string
}) {
  const [panelOpen, setPanelOpen] = createSignal(true)
  const detail = createSectionFold(true)
  const borderOn = () => props.display.panelBorder
  const layout = createPanelLayout({ border: borderOn })

  const m = useCacheHitMetrics({
    theme: () => props.theme,
    display: props.display,
    main: props.main,
    speed: props.speed,
    layout,
  })

  return (
    <Show when={props.sessionId().length > 0}>
      <TuiPanel pal={m.pal()} border={borderOn()} layout={layout}>
        <TuiPanelTitle
          pal={m.pal()}
          layout={layout}
          open={panelOpen()}
          onToggle={() => setPanelOpen((o) => !o)}
          title={m.t().title}
          version={PLUGIN_VERSION}
          collapsed={
            <Show when={m.hasData()}>
              <TuiTitleSummaryPad
                layout={layout}
                titleWidth={visualWidth(m.t().title)}
                summaryWidth={m.collapsedHitSummary().width}
              >
                <span style={{ fg: m.hitColor() }}>{m.collapsedHitSummary().text}</span>
              </TuiTitleSummaryPad>
            </Show>
          }
        />

        <Show when={panelOpen()}>
          <Show
            when={m.hasData()}
            fallback={<TuiPanelNoData pal={m.pal()} layout={layout} message={m.t().noData} />}
          >
            <TuiPanelSep pal={m.pal()} layout={layout} />
            <MainSessionView m={m} layout={layout} detail={detail} formatCost={props.formatCost} />
          </Show>
        </Show>
      </TuiPanel>
    </Show>
  )
}
