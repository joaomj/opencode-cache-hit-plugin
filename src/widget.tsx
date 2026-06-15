/** @jsxImportSource @opentui/solid */
import { createMemo, createSignal, Show, type Accessor } from "solid-js"
import type { DisplayConfig, CacheTTLConfig } from "./plugin-config.ts"
import type { AssistantMessage, ProviderInfo, SessionSnapshot, SubAgentSummary } from "./types.ts"
import { PLUGIN_VERSION } from "./version.ts"
import { AgentsView } from "./agents-view.tsx"
import { MainSessionView } from "./main-session-view.tsx"

import { useCacheHitMetrics } from "./use-cache-hit-metrics.ts"
import {
  createPanelLayout,
  createSectionFold,
  TuiPanel,
  TuiPanelNoData,
  TuiPanelSep,
  TuiPanelTitle,
  TuiSection,
  TuiTitleSummaryPad,
  visualWidth,
} from "./tui-panel/index.ts"

export function CacheHitSidebar(props: {
  sessionId: Accessor<string>
  theme: Record<string, unknown>
  display: DisplayConfig
  cacheTTL: CacheTTLConfig
  messages: Accessor<AssistantMessage[]>
  main: Accessor<SessionSnapshot>
  subAgents: Accessor<SubAgentSummary[]>
  providers: Accessor<ReadonlyArray<ProviderInfo>>
  formatCost: (amount: number) => string
  formatRate: (perMillion: number) => string
  streamingSpeed: Accessor<number>
  streamingSpeedLabel: Accessor<string>
  firstPartTime: ReadonlyMap<string, number>
}) {
  const [panelOpen, setPanelOpen] = createSignal(true)
  const detail = createSectionFold(true)
  const speed = createSectionFold(true)
  const model = createSectionFold(true)
  const agents = createSectionFold(true)

  const borderOn = () => props.display.panelBorder
  const layout = createPanelLayout({ border: borderOn })

  const m = useCacheHitMetrics({
    theme: () => props.theme,
    display: props.display,
    messages: props.messages,
    main: props.main,
    subAgents: props.subAgents,
    providers: props.providers,
    layout,
    firstPartTime: props.firstPartTime,
  })

  const agentsSuffix = createMemo(() => {
    const n = m.subs().length
    if (n === 0) return ""
    return ` (${n})${m.t().agentsScopeHint}`
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
            <>
              <Show when={m.hasData() && m.mainHasStats()}>
                <TuiTitleSummaryPad
                  layout={layout}
                  titleWidth={visualWidth(m.t().title)}
                  summaryWidth={m.collapsedHitSummary().width}
                >
                  <span style={{ fg: m.hitColor() }}>{m.collapsedHitSummary().text}</span>
                </TuiTitleSummaryPad>
              </Show>
              <Show when={m.hasData() && !m.mainHasStats() && m.subs().length > 0}>
                <TuiTitleSummaryPad
                  layout={layout}
                  titleWidth={visualWidth(m.t().title)}
                  summaryWidth={visualWidth(props.formatCost(m.totalSubCost()))}
                >
                  <span style={{ fg: m.pal().success }}>{props.formatCost(m.totalSubCost())}</span>
                </TuiTitleSummaryPad>
              </Show>
            </>
          }
        />

        <Show when={panelOpen()}>
          <Show
            when={m.hasData()}
            fallback={<TuiPanelNoData pal={m.pal()} layout={layout} message={m.t().noData} />}
          >
            <TuiPanelSep pal={m.pal()} layout={layout} />
            <MainSessionView
              m={m}
              layout={layout}
              detail={detail}
              speed={speed}
              model={model}
              showSpeed={props.display.showSpeed}
              streamingSpeed={props.streamingSpeed}
              streamingSpeedLabel={props.streamingSpeedLabel}
              formatCost={props.formatCost}
              formatRate={props.formatRate}
              cacheTTL={props.cacheTTL}
              messages={props.messages}
            />
            <Show when={m.subs().length > 0}>
              <TuiSection
                pal={m.pal()}
                layout={layout}
                open={agents.open()}
                title={m.t().secAgents}
                suffix={agentsSuffix()}
                onToggle={agents.toggle}
              >
                <AgentsView m={m} layout={layout} providers={props.providers()} formatCost={props.formatCost} />
              </TuiSection>
            </Show>
          </Show>
        </Show>
      </TuiPanel>
    </Show>
  )
}
