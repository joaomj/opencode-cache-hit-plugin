/** @jsxImportSource @opentui/solid */
import { createEffect, createMemo, createSignal, onCleanup } from "solid-js"
import { CacheHitSidebar } from "./widget.tsx"
import type { DisplayConfig, TimelineConfig } from "./plugin-config.ts"
import { isToolSummaryEnabled } from "./plugin-config.ts"
import { createTimelineCollector } from "./timeline/collector.ts"
import { createToolTimingTracker, type ToolPartEventData } from "./tool-timing.ts"
import { isPartUpdatedEvent } from "./types.ts"
import type { AssistantMessage, OpenCodeTuiApi } from "./types.ts"
import { createFirstPartTimeTracker, visibleTextTimingFromParts } from "./first-part-time.ts"
import { aggregateFromSessionObject, aggregateSessionFromMessages, emptySessionSnapshot, mainSessionHasStats } from "./stats.ts"
import {
  addSessionSpeed,
  aggregateSessionSpeed,
  EMPTY_SESSION_SPEED,
  loadSessionSpeed,
  sessionMessageKey,
  speedContribution,
  type SessionSpeedMetrics,
  type SessionSpeedTotals,
} from "./session-metrics.ts"

/** Session-only host. Timeline tracking is created only when explicitly enabled. */
export function CacheHitSidebarHost(props: {
  sessionId: string
  theme: Record<string, unknown>
  display: DisplayConfig
  timeline: TimelineConfig
  api: OpenCodeTuiApi
}) {
  const [refreshTick, setRefreshTick] = createSignal(0)
  const [speedMetrics, setSpeedMetrics] = createSignal<SessionSpeedMetrics>({
    session: EMPTY_SESSION_SPEED,
  })
  const firstPartTracker = createFirstPartTimeTracker()
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
        textTiming: (messageID) => firstPartTracker.get().get(messageID),
      })
    : undefined

  onCleanup(() => {
    toolTiming?.dispose()
    timeline?.dispose()
    firstPartTracker.dispose()
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

  const seedFirstPartTime = (message: AssistantMessage) => {
    const messageID = sessionMessageKey(message)
    const created = message.time?.created
    if (!messageID || typeof created !== "number") return
    const timing = visibleTextTimingFromParts(props.api.state.part?.(messageID), created)
    if (timing && firstPartTracker.handlePart(messageID, "text", timing.start, timing.end)) bumpRefresh()
  }

  const currentSessionMessages = (): AssistantMessage[] => {
    const sid = props.sessionId
    return sid ? (props.api.state.session.messages(sid) ?? []) as AssistantMessage[] : []
  }

  const resetSpeed = () => {
    const sid = props.sessionId
    speedLoadGeneration++
    seenSpeedMessages = new Set()
    pendingSpeedMessages = new Map()
    const messages = currentSessionMessages()
    for (const message of messages) seedFirstPartTime(message)
    const fallback = aggregateSessionSpeed(messages, firstPartTracker.get())
    setSpeedMetrics({ session: fallback })
    if (!sid || !props.api.client.session.messages) {
      seenSpeedMessages = new Set(messages.map(sessionMessageKey).filter((key): key is string => key !== undefined))
      return
    }

    const generation = speedLoadGeneration
    void loadSessionSpeed({
      client: props.api.client.session,
      sessionId: sid,
      directory: props.api.state.path.directory,
      fallback,
      textTiming: firstPartTracker.get(),
      part: props.api.state.part,
    }).then((result) => {
      if (generation !== speedLoadGeneration) return
      let totals = result.speed
      for (const [key, contribution] of pendingSpeedMessages) {
        if (!result.messageKeys.includes(key)) totals = addSessionSpeed(totals, contribution)
      }
      seenSpeedMessages = new Set(result.messageKeys)
      for (const key of pendingSpeedMessages.keys()) seenSpeedMessages.add(key)
      setSpeedMetrics({
        session: totals,
      })
      pendingSpeedMessages = new Map()
    })
  }

  createEffect(() => {
    void props.sessionId
    void props.api.state.path.directory
    timeline?.reset()
    toolTiming?.reset()
    firstPartTracker.reset()
    resetSpeed()
  })

  createEffect(() => {
    const unsub = props.api.event.on("message.updated", (event) => {
      const msg = event.properties?.info as (AssistantMessage & { sessionID?: string }) | undefined
      const sid = msg?.sessionID
      if (sid === props.sessionId && msg?.role === "assistant") {
        seedFirstPartTime(msg)
        const key = sessionMessageKey(msg)
        const contribution = speedContribution(msg, firstPartTracker.get())
        if (contribution && key && !seenSpeedMessages.has(key)) {
          seenSpeedMessages.add(key)
          pendingSpeedMessages.set(key, contribution)
          setSpeedMetrics((metrics) => ({
            ...metrics,
            session: addSessionSpeed(metrics.session, contribution),
          }))
        }
        bumpRefresh()
      }
      if (sid && msg) timeline?.handleMessage(sid, msg)
    })
    onCleanup(() => unsub?.())
  })

  createEffect(() => {
    const unsub = props.api.event.on("message.part.updated", (event) => {
      if (!isPartUpdatedEvent(event)) return
      const { part } = event.properties
      if (
        !part.synthetic &&
        !part.ignored &&
        typeof part.time?.start === "number" &&
        firstPartTracker.handlePart(part.messageID, part.type, part.time.start, part.time.end)
      ) {
        bumpRefresh()
      }
      if (part.type === "tool") toolTiming?.handleToolPart(part.messageID, part as ToolPartEventData)
    })
    onCleanup(() => {
      unsub?.()
    })
  })

  return (
    <CacheHitSidebar
      sessionId={() => props.sessionId}
      theme={props.theme}
      display={props.display}
      main={mainSnap}
      speed={speedMetrics}
    />
  )
}
