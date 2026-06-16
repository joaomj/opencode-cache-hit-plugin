# TTFT Hybrid Implementation

This document describes how opencode-cache-hit measures **Time To First Token (TTFT)** and **generation-speed denominators** in the sidebar **Speed** section (and in optional timeline JSONL when `timeline.enabled` is true).

## Background

OpenCode exposes optional per-part timing:

```typescript
type TextPart = {
  time?: { start: number; end?: number }  // optional
}
```

`part.time.start` is often missing because of SDK design, provider differences, proxies, event ordering, or upstream bugs (e.g. [#21544](https://github.com/anomalyco/opencode/issues/21544)). The plugin therefore combines several data sources.

> **Terminology**: In this document, **"sdk"** refers to the OpenCode SDK processor layer — where `part.time.start = Date.now()` is recorded when the first streaming chunk arrives. It is **not** the LLM provider API. **"tui"** refers to the TUI plugin's JavaScript event handler (`Date.now()` in `message.part.delta` callback). Both are local measurements; neither comes from the LLM provider.

**Sidebar TTFT is always collected** via `src/first-part-time.ts`. **`timeline.enabled` only controls JSONL disk writes** — not the sidebar row.

## Data sources (priority order)

### 1. SDK-side timing (preferred)

| | |
|--|--|
| **Trigger** | `message.part.updated` |
| **Fields** | `part.time.start` on `text` or `reasoning` parts |
| **Formula** | `ttftMs = part.time.start - msg.time.created` |
| **Accuracy** | Best — earliest available timestamp (SDK-local, before IPC/event-loop delay to TUI plugin) |

### 2. TUI-side timing (fallback)

| | |
|--|--|
| **Trigger** | First `message.part.delta` with `field` = `text` or `reasoning` |
| **Fields** | `Date.now()` at receive time |
| **Formula** | `ttftMs = Date.now() - msg.time.created` |
| **Accuracy** | Includes all latency (provider processing + internet + SDK internal + local IPC + JS event-loop); depends on BusEvent delivery |

### 3. Part-state scan (fallback)

| | |
|--|--|
| **Trigger** | `message.updated` for an assistant message when no timestamp is stored yet; also each 1s streaming poll on the in-flight message while **Now** is active |
| **Fields** | Earliest `part.time.start` among `text` / `reasoning` parts from `api.state.part()` |
| **Formula** | Same as source 1 |
| **Accuracy** | Same as SDK-side when persisted parts include `time.start` |

**Role of `api.state.part()`**: OpenCode keeps a state store of parts per message. When part events are missing or arrive late, `message.updated` can scan this store for the earliest valid `time.start`. This works when parts were persisted with timing data; some backends (e.g. local models without a parts table) still have no usable `time.start` — see [ttft-troubleshooting.md](./ttft-troubleshooting.md).

## Priority rules

SDK timestamps win over TUI timestamps for the same message. Once an SDK value is stored, later TUI events are ignored. TUI values can be upgraded when a valid SDK `time.start` arrives later.

Timestamps with `start <= msg.time.created` are discarded (clock skew / bad SDK data).

Logic lives in `createFirstPartTimeTracker()` (`src/first-part-time.ts`).

## Data flow

```mermaid
sequenceDiagram
    participant SDK as OpenCode SDK
    participant Host as sidebar-host
    participant Tracker as first-part-time
    participant UI as Speed section
    participant Timeline as timeline JSONL

    Note over SDK: Streaming starts
    SDK->>Host: message.part.updated
    Host->>Tracker: store sdk time.start

    Note over SDK: No time.start on event
    SDK->>Host: message.part.delta
    Host->>Tracker: store tui Date.now()

    Note over SDK: Streaming poll (1s)
    Host->>Tracker: scan api.state.part on in-flight if still empty

    Note over SDK: Turn completes
    SDK->>Host: message.updated
    Host->>Tracker: scan api.state.part if still empty
    Host->>UI: TTFT row + Last/Avg/Now speed denominators
    Host->>Timeline: append record if timeline.enabled
```

## Modules

| Module | Role |
|--------|------|
| `src/first-part-time.ts` | Per-message first-part timestamps |
| `src/sidebar-host.tsx` | Subscribes to part / message events |
| `src/use-cache-hit-metrics.ts` | `lastTtft`, **Last** / **Avg** / sparkline speed (gen time when tracked) |
| `src/streaming-state.ts` | Streaming **Now** speed denominator (via `advanceStreamingNow`) |
| `src/timeline/collector.ts` | Writes `ttftMs` / `ttftSource` when timeline is enabled |

## Sidebar display

Shows the most recent non-summary assistant turn with a valid first-part timestamp — available during streaming once the first token arrives (`944ms`, `1.2s`, or `"—"`). The same tracker drives **Now** / **Last** / **Avg** generation-speed denominators when timestamps exist. Display rules and troubleshooting: [ttft-troubleshooting.md](./ttft-troubleshooting.md).

## Timeline JSONL

When `timeline.enabled: true`, each completed assistant record may include:

```typescript
{
  ttftMs?: number
  ttftSource?: "sdk" | "tui"
}
```

Same tracker as the sidebar; see [timeline.md](./timeline.md).

## Comparison with other plugins

| Plugin | Approach |
|--------|----------|
| opencode-throughput | `part.time.start` only |
| opencode-hud | TUI `performance.now()` only |
| oc-tps | text/reasoning delta + tool.pending fallback |
| opencode-cache-hit | SDK + TUI + part-state scan + tool.pending fallback |

## Tests

| Area | File |
|------|------|
| Tracker | `tests/first-part-time.test.ts` |
| Record fields | `tests/timeline-records.test.ts` |
| Timeline integration | `tests/timeline-collector.test.ts` |

## References

- [TTFT Troubleshooting](./ttft-troubleshooting.md)
- [OpenCode Issue #21544](https://github.com/anomalyco/opencode/issues/21544)
- [OpenCode Issue #26924](https://github.com/anomalyco/opencode/issues/26924)
- [OpenCode Issue #27663](https://github.com/anomalyco/opencode/issues/27663)
- [OpenCode Issue #23673](https://github.com/anomalyco/opencode/issues/23673)
