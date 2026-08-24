/** @jsxImportSource @opentui/solid */
import { createEffect, createMemo, createSignal, onCleanup } from "solid-js"
import { CacheHitSidebar } from "./widget.tsx"
import type { DisplayConfig, TimelineConfig } from "./plugin-config.ts"
import { isToolSummaryEnabled } from "./plugin-config.ts"
import { createTimelineCollector } from "./timeline/collector.ts"
import { createToolTimingTracker, type ToolPartEventData } from "./tool-timing.ts"
import { isPartUpdatedEvent } from "./types.ts"
import type { AssistantMessage, OpenCodeTuiApi } from "./types.ts"
import { aggregateFromSessionObject, aggregateSessionFromMessages, emptySessionSnapshot, mainSessionHasStats } from "./stats.ts"
import {
  addSessionSpeed,
  aggregateSessionSpeed,
  EMPTY_SESSION_SPEED,
  loadSessionSpeed,
  sessionMessageKey,
  speedContribution,
  type SessionSpeedTotals,
} from "./session-metrics.ts"

/** Session-only host. Timeline tracking is created only when explicitly enabled. */
export function CacheHitSidebarHost(props: {
  sessionId: string
  theme: Record<string, unknown>
  display: DisplayConfig
  timeline: TimelineConfig
  formatCost: (amount: number) => string
  api: OpenCodeTuiApi
}) {
  const [refreshTick, setRefreshTick] = createSignal(0)
  const [speedTotals, setSpeedTotals] = createSignal<SessionSpeedTotals>(EMPTY_SESSION_SPEED)
  let speedLoadGeneration = 0
  let seenSpeedMessages = new Set<string>()
  let pendingSpeedMessages = new Map<string, SessionSpeedTotals>()

  const bumpRefresh = () => setRefreshTick((v) => v + 1)
  const timelineEnabled = props.timeline.enabled
  const toolTiming = timelineEnabled
    ? createToolTimingTracker({
        isSummaryEnabled: (tool) => isToolSummaryEnabled(props.timeline.toolSummary, tool),
      })
    : undefined
  const timeline = timelineEnabled && toolTiming
    ? createTimelineCollector({
        getConfig: () => props.timeline,
        getSessionId: () => props.sessionId,
        toolTiming,
      })
    : undefined

  onCleanup(() => {
    toolTiming?.dispose()
    timeline?.dispose()
  })

  const mainSnap = createMemo(() => {
    void refreshTick()
    const sid = props.sessionId
    if (!sid) return emptySessionSnapshot()
    const session = props.api.state.session.get?.(sid)
    if (session) {
      const snap = aggregateFromSessionObject(session)
      if (mainSessionHasStats(snap)) return snap
    }
    const messages = props.api.state.session.messages(sid)
    return messages?.length
      ? aggregateSessionFromMessages(messages as AssistantMessage[])
      : emptySessionSnapshot()
  })

  const resetSpeed = () => {
    const sid = props.sessionId
    speedLoadGeneration++
    seenSpeedMessages = new Set()
    pendingSpeedMessages = new Map()
    const messages = sid ? (props.api.state.session.messages(sid) ?? []) as AssistantMessage[] : []
    const fallback = aggregateSessionSpeed(messages)
    setSpeedTotals(fallback)
    if (!sid || !props.api.client.session.messages) return

    const generation = speedLoadGeneration
    void loadSessionSpeed({
      client: props.api.client.session,
      sessionId: sid,
      directory: props.api.state.path.directory,
      fallback,
    }).then((result) => {
      if (generation !== speedLoadGeneration) return
      let totals = result.speed
      for (const [key, contribution] of pendingSpeedMessages) {
        if (!result.messageKeys.includes(key)) totals = addSessionSpeed(totals, contribution)
      }
      seenSpeedMessages = new Set(result.messageKeys)
      for (const key of pendingSpeedMessages.keys()) seenSpeedMessages.add(key)
      setSpeedTotals(totals)
      pendingSpeedMessages = new Map()
    })
  }

  createEffect(() => {
    void props.sessionId
    void props.api.state.path.directory
    timeline?.reset()
    toolTiming?.reset()
    resetSpeed()
  })

  createEffect(() => {
    const unsub = props.api.event.on("message.updated", (event) => {
      const msg = event.properties?.info as (AssistantMessage & { sessionID?: string }) | undefined
      const sid = msg?.sessionID
      if (sid === props.sessionId && msg?.role === "assistant") {
        const key = sessionMessageKey(msg)
        const contribution = speedContribution(msg)
        if (msg.time?.completed !== undefined && contribution && key && !seenSpeedMessages.has(key)) {
          seenSpeedMessages.add(key)
          pendingSpeedMessages.set(key, contribution)
          setSpeedTotals((totals) => addSessionSpeed(totals, contribution))
        }
        bumpRefresh()
      }
      if (sid && msg) timeline?.handleMessage(sid, msg)
    })
    onCleanup(() => unsub?.())
  })

  createEffect(() => {
    if (!timeline || !toolTiming) return
    const unsub1 = props.api.event.on("message.part.updated", (event) => {
      if (!isPartUpdatedEvent(event)) return
      const { part } = event.properties
      if (part.type === "tool") toolTiming.handleToolPart(part.messageID, part as ToolPartEventData)
    })
    onCleanup(() => {
      unsub1?.()
    })
  })

  return (
    <CacheHitSidebar
      sessionId={() => props.sessionId}
      theme={props.theme}
      display={props.display}
      main={mainSnap}
      speed={speedTotals}
      formatCost={props.formatCost}
    />
  )
}
