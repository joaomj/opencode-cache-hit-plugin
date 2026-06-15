/** @jsxImportSource @opentui/solid */
import { createSignal, createMemo, createEffect, onCleanup } from "solid-js"
import { CacheHitSidebar } from "./widget.tsx"
import type { DisplayConfig, TimelineConfig, CacheTTLConfig } from "./plugin-config.ts"
import { createTimelineCollector } from "./timeline/collector.ts"
import {
  createFirstPartTimeTracker,
  earliestPartStart,
} from "./first-part-time.ts"
import type {
  AssistantMessage,
  OpenCodeTuiApi,
  PartUpdatedEvent,
  SubAgentSummary,
} from "./types.ts"
import {
  emptySessionSnapshot,
  aggregateFromSessionObject,
  aggregateSessionFromMessages,
  mainSessionHasStats,
  subAgentHasStats,
  toSubAgentSummary,
  withModelFallback,
} from "./stats.ts"
import { createChildSessionSync } from "./child-session-sync.ts"
import { loadPluginConfig } from "./load-config.ts"
import {
  advanceStreamingNow,
  computeAvgTokenSpeed,
  initialStreamingTickState,
  type StreamingPhase,
} from "./token-speed.ts"

const STREAM_FIELDS = new Set(["text", "reasoning"])

/**
 * Session-scoped sidebar host. Bumps `refreshTick` on message.updated
 * so memos re-compute. Prefers session.get() for aggregate cost/tokens
 * (DB-level, not capped at 100 messages), falls back to session.messages().
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

  const firstPartTracker = createFirstPartTimeTracker()
  onCleanup(() => firstPartTracker.dispose())

  const timeline = createTimelineCollector({
    config: props.timeline,
    getRootSessionId: () => props.sessionId,
    getChildIds: childIds,
    firstPartTime: firstPartTracker,
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
    const session = props.api.state.session.get(sid)
    if (session) {
      const snap = aggregateFromSessionObject(session)
      if (mainSessionHasStats(snap)) {
        const msgs = props.api.state.session.messages(sid) as AssistantMessage[] | undefined
        return msgs ? withModelFallback(snap, msgs) : snap
      }
    }
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

  const subAgentList = createMemo(() => {
    void refreshTick()
    return childIds()
      .map((cid) => {
        const session = props.api.state.session.get(cid)
        if (session) {
          const snap = aggregateFromSessionObject(session)
          if (subAgentHasStats(snap)) {
            const msgs = props.api.state.session.messages(cid) as AssistantMessage[] | undefined
            const merged = msgs ? withModelFallback(snap, msgs) : snap
            const speed = msgs ? computeAvgTokenSpeed(msgs) : 0
            return toSubAgentSummary(cid, merged, speed)
          }
        }
        const msgs = props.api.state.session.messages(cid)
        if (!msgs?.length) return null
        const snap = aggregateSessionFromMessages(msgs as AssistantMessage[])
        if (!subAgentHasStats(snap)) return null
        const speed = computeAvgTokenSpeed(msgs as AssistantMessage[])
        return toSubAgentSummary(cid, snap, speed)
      })
      .filter(Boolean) as SubAgentSummary[]
  })

  const [streamingNow, setStreamingNow] = createSignal<{ phase: StreamingPhase; speed: number }>({
    phase: "idle",
    speed: 0,
  })
  let streamingTickState = initialStreamingTickState()

  const firstPartTime = createMemo(() => {
    void refreshTick()
    return firstPartTracker.get()
  })

  const recordPart = (
    messageID: string,
    partType: string,
    startTime: number,
    source: "server" | "client",
  ) => {
    if (firstPartTracker.handlePart(messageID, partType, startTime, source)) {
      bumpRefresh()
    }
  }

  const seedTtftFromParts = (msg: AssistantMessage) => {
    const msgID = msg.id ?? msg.messageID
    const created = msg.time?.created
    if (!msgID || typeof created !== "number" || firstPartTracker.get().has(msgID)) return
    if (!props.api.state.part) return
    const start = earliestPartStart(props.api.state.part(msgID), created)
    if (start !== undefined) {
      recordPart(msgID, "text", start, "server")
    }
  }

  const trackStreaming = () => {
    const messages = mainMessages()
    const last = messages[messages.length - 1]
    if (last?.role === "assistant" && !last.time?.completed) {
      seedTtftFromParts(last)
    }
    const result = advanceStreamingNow(streamingTickState, {
      messages,
      part: props.api.state.part,
      now: Date.now(),
      firstPartTime: firstPartTracker.get(),
    })
    streamingTickState = result
    setStreamingNow({ phase: result.phase, speed: result.speed })
  }

  createEffect(() => {
    const interval = setInterval(trackStreaming, 1000)
    onCleanup(() => clearInterval(interval))
  })

  createEffect(() => {
    const sid = props.sessionId
    void props.api.state.path.directory
    childSync.resetForParentChange()
    timeline.resetForRootChange()
    firstPartTracker.reset()
    streamingTickState = initialStreamingTickState()
    setStreamingNow({ phase: "idle", speed: 0 })
    if (sid) {
      childSync.loadChildren()
    }
  })

  createEffect(() => {
    const unsub = props.api.event.on("message.updated", (event) => {
      bumpRefresh()
      const msg = event.properties?.info as (AssistantMessage & { sessionID?: string }) | undefined
      const sid = msg?.sessionID
      childSync.onForeignSessionActivity(sid)
      if (msg?.role === "assistant") {
        seedTtftFromParts(msg)
      }
      if (sid && msg) {
        timeline.handleMessage(sid, msg)
      }
    })
    onCleanup(() => unsub?.())
  })

  createEffect(() => {
    const unsub1 = props.api.event.on("message.part.updated", (event) => {
      const part = (event as PartUpdatedEvent).properties?.part
      if (
        part?.messageID &&
        STREAM_FIELDS.has(part.type) &&
        typeof part.time?.start === "number"
      ) {
        recordPart(part.messageID, part.type, part.time.start, "server")
      }
    })
    const unsub2 = props.api.event.on("message.part.delta", (event) => {
      const eventProps = event.properties as
        | { messageID?: string; partID?: string; field?: string }
        | undefined
      if (eventProps?.messageID && eventProps.field && STREAM_FIELDS.has(eventProps.field)) {
        recordPart(eventProps.messageID, eventProps.field, Date.now(), "client")
      }
    })
    onCleanup(() => {
      unsub1?.()
      unsub2?.()
    })
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
      streamingNow={streamingNow}
      firstPartTime={firstPartTime}
    />
  )
}
