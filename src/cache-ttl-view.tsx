/**
 * Cache TTL elapsed time display.
 * Inspired by opencode-cache-timer (https://github.com/nero-sensei/opencode-cache-timer)
 * by nero-sensei.
 */
/** @jsxImportSource @opentui/solid */
import { createMemo, createSignal, onCleanup, Show, type Accessor } from "solid-js"
import type { AssistantMessage } from "./types.ts"
import type { CacheTTLConfig } from "./plugin-config.ts"
import { parseDuration } from "./plugin-config.ts"
import type { PanelPalette, PanelLayout } from "./tui-panel/index.ts"

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE

const DEFAULT_TTL_MS = 5 * MINUTE

const BUILT_IN_TTL: Record<string, number> = {
  anthropic: 5 * MINUTE,
  openai: 5 * MINUTE,
  deepseek: 2 * HOUR,
  google: 1 * HOUR,
  xai: 5 * MINUTE,
  minimax: 5 * MINUTE,
  xiaomi: 5 * MINUTE,
  qwen: 5 * MINUTE,
  moonshot: 5 * MINUTE,
}

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

function getTTL(
  providerID: string,
  modelID: string,
  config: CacheTTLConfig,
): number {
  const userProviders = config.providers
  const specific = userProviders[`${providerID}:${modelID}`]
  if (specific !== undefined) {
    const parsed = parseDuration(specific)
    if (parsed !== null) return parsed
  }
  const userProvider = userProviders[providerID]
  if (userProvider !== undefined) {
    const parsed = parseDuration(userProvider)
    if (parsed !== null) return parsed
  }
  const builtIn = BUILT_IN_TTL[providerID]
  if (builtIn !== undefined) return builtIn
  return DEFAULT_TTL_MS
}

function formatElapsed(ms: number): string {
  if (ms <= 0) return "0s"
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}

export function CacheTTLView(props: {
  messages: Accessor<AssistantMessage[]>
  config: CacheTTLConfig
  pal: PanelPalette
  layout: PanelLayout
  label: string
}) {
  const [now, setNow] = createSignal(Date.now())
  const tick = setInterval(() => setNow(Date.now()), 1000)
  onCleanup(() => clearInterval(tick))

  const lastCache = createMemo(() => findLastCacheActivity(props.messages))

  const ttlMs = createMemo(() => {
    const m = lastCache()
    if (!m || !m.providerID) return DEFAULT_TTL_MS
    return getTTL(m.providerID, m.modelID ?? "", props.config)
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
