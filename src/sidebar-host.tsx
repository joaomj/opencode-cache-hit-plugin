/** @jsxImportSource @opentui/solid */
import { createSignal, createMemo, createEffect, onCleanup } from "solid-js"
import { CacheHitSidebar } from "./widget.tsx"
import type { DisplayConfig, TimelineConfig, CacheTTLConfig } from "./plugin-config.ts"
import { createTimelineCollector } from "./timeline/collector.ts"
import type { AssistantMessage, OpenCodeTuiApi, SubAgentSummary } from "./types.ts"
import {
  emptySessionSnapshot,
  aggregateSessionFromMessages,
  subAgentHasStats,
  toSubAgentSummary,
} from "./stats.ts"
import { createChildSessionSync } from "./child-session-sync.ts"
import { loadPluginConfig } from "./load-config.ts"

/**
 * Session-scoped sidebar host. Bumps `refreshTick` on message.updated (same as visual-cache)
 * so memos re-read api.state.session.messages.
 * Timeline writes are event-driven: message.updated → handleMessage → appendFile.
 */
export function CacheHitSidebarHost(props: {
  sessionId: string
  theme: Record<string, unknown>
  display: DisplayConfig
  timeline: TimelineConfig
  cacheTTL: CacheTTLConfig
  formatCost: (amount: number) => string
  formatRate: (perMillion: number) => string
  api: OpenCodeTuiApi
}) {
  const [refreshTick, setRefreshTick] = createSignal(0)
  const [childIds, setChildIds] = createSignal<string[]>([])

  /** Re-read cache-hit.config.json when parent session changes (picks up edits without full plugin reload). */
  const runtimeConfig = createMemo(() => {
    void props.sessionId
    return loadPluginConfig()
  })
  const display = createMemo(() => runtimeConfig().display)
  const cacheTTL = createMemo(() => runtimeConfig().cacheTTL)

  const bumpRefresh = () => setRefreshTick((v) => v + 1)

  const timeline = createTimelineCollector({
    config: props.timeline,
    getRootSessionId: () => props.sessionId,
    getChildIds: childIds,
  })
  onCleanup(() => timeline.dispose())

  const childSync = createChildSessionSync({
    client: props.api.client.session,
    getDirectory: () => props.api.state.path.directory,
    getParentId: () => props.sessionId,
    setChildIds,
    onSynced: () => {
      bumpRefresh()
    },
  })
  onCleanup(() => childSync.dispose())

  const mainSnap = createMemo(() => {
    void refreshTick()
    const sid = props.sessionId
    if (!sid) return emptySessionSnapshot()
    const msgs = props.api.state.session.messages(sid)
    return msgs?.length
      ? aggregateSessionFromMessages(msgs as AssistantMessage[])
      : emptySessionSnapshot()
  })

  const mainMessages = createMemo(() => {
    void refreshTick()
    const sid = props.sessionId
    if (!sid) return [] as AssistantMessage[]
    return (props.api.state.session.messages(sid) ?? []) as AssistantMessage[]
  })

  const subAgentList = createMemo(() =>
    childIds()
      .map((cid) => {
        const msgs = props.api.state.session.messages(cid)
        if (!msgs?.length) return null
        const snap = aggregateSessionFromMessages(msgs as AssistantMessage[])
        if (!subAgentHasStats(snap)) return null
        return toSubAgentSummary(cid, snap)
      })
      .filter(Boolean) as SubAgentSummary[],
  )

  createEffect(() => {
    const sid = props.sessionId
    void props.api.state.path.directory
    childSync.resetForParentChange()
    timeline.resetForRootChange()
    if (sid) {
      childSync.loadChildren()
    }
  })

  createEffect(() => {
    const unsub = props.api.event.on("message.updated", (event) => {
      bumpRefresh()
      const sid = event.properties?.info?.sessionID
      childSync.onForeignSessionActivity(sid)
      if (sid && event.properties?.info) {
        timeline.handleMessage(sid, event.properties.info as AssistantMessage)
      }
    })
    onCleanup(() => unsub?.())
  })

  return (
    <CacheHitSidebar
      sessionId={() => props.sessionId}
      theme={props.theme}
      display={display()}
      cacheTTL={cacheTTL()}
      messages={mainMessages}
      main={mainSnap}
      subAgents={subAgentList}
      providers={() => props.api.state.provider ?? []}
      formatCost={props.formatCost}
      formatRate={props.formatRate}
    />
  )
}
