/**
 * Cache TTL elapsed time display.
 * Inspired by opencode-cache-timer (https://github.com/nero-sensei/opencode-cache-timer)
 * by nero-sensei.
 */
/** @jsxImportSource @opentui/solid */
import { createMemo, createSignal, onCleanup, Show, type Accessor } from "solid-js"
import type { AssistantMessage } from "./types.ts"
import { type CacheTTLConfig, DEFAULT_CACHE_TTL } from "./plugin-config.ts"
import { getTTL, formatElapsed, DEFAULT_TTL_MS } from "./cache-ttl.ts"
import type { PanelPalette, PanelLayout } from "./tui-panel/index.ts"

function findLastCacheActivity(messages: Accessor<AssistantMessage[]>): AssistantMessage | null {
  const msgs = messages()
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i]
    if (
      m.role === "assistant" &&
      m.time?.completed !== undefined &&
      ((m.tokens?.cache?.read ?? 0) > 0 || (m.tokens?.cache?.write ?? 0) > 0)
    ) {
      return m
    }
  }
  return null
}

export function CacheTTLView(props: {
  messages: Accessor<AssistantMessage[]>
  config?: CacheTTLConfig
  pal: PanelPalette
  layout: PanelLayout
  label: string
}) {
  const [now, setNow] = createSignal(Date.now())
  const tick = setInterval(() => setNow(Date.now()), 1000)
  onCleanup(() => clearInterval(tick))

  const lastCache = createMemo(() => findLastCacheActivity(props.messages))

  // Self-heal against partial/undefined config reaching this component (see #1, #3):
  // a stale-cached plugin build may pass { enabled: true } without `providers`.
  const safeConfig = createMemo(() =>
    props.config?.providers ? props.config : DEFAULT_CACHE_TTL,
  )

  const ttlMs = createMemo(() => {
    const m = lastCache()
    if (!m || !m.providerID) return DEFAULT_TTL_MS
    return getTTL(m.providerID, m.modelID ?? "", safeConfig())
  })

  const elapsed = createMemo(() => {
    const m = lastCache()
    if (!m || m.time.completed === undefined) return null
    return now() - m.time.completed
  })

  const statusIcon = createMemo(() => {
    const e = elapsed()
    const ttl = ttlMs()
    if (e === null) return ""
    if (e < ttl) return "●"
    if (e < ttl * 2) return "◐"
    return "○"
  })

  const statusColor = createMemo(() => {
    const e = elapsed()
    const ttl = ttlMs()
    if (e === null) return props.pal.textMuted
    if (e < ttl) return props.pal.success
    if (e < ttl * 2) return props.pal.warning
    return props.pal.error
  })

  return (
    <Show when={elapsed() !== null}>
      <text fg={statusColor()}>
        {props.layout.row(props.label, `${statusIcon()} ${formatElapsed(elapsed()!)}`, "")}
      </text>
    </Show>
  )
}
