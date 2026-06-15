# Token Speed Sidebar — Design

Feature: display **token generation speed** (tokens/second) in the sidebar panel, alongside existing cache hit rate / token / cost metrics.

## 1. Reference: MiMo-Code sidebar

MiMo-Code's TUI sidebar displays speed using two modes:
- **Streaming**: char-based heuristic (4 chars ≈ 1 token), updated every 1s
- **Completed**: real token counts from `StepFinishPart.tokens`

---

## 2. Features

### Completed-call speed

Display token speed for **finished** LLM calls using real token counts. When `firstPartTime` is tracked (same hybrid TTFT tracker), **Last**, **Avg**, and the sparkline use generation time (first token → completion), excluding TTFT; otherwise they fall back to full turn duration (`completed - created`).

### Real-time streaming speed

Live speed estimation during streaming using char/4 heuristic. Requires `api.state.part(id)` to access streaming text content.

**Now** row states:

| State | Display | Color |
|-------|---------|-------|
| Idle (no stream) | `·` | muted |
| Warmup (TTFT wait, &lt;500ms since start, or no text yet) | `<1 tok/s` | success |
| Active | `N tok/s` | success |
| Hold (2s after stream ends) | last `N tok/s` | muted |

`—` is reserved for metrics with no data (e.g. TTFT), not for idle streaming.

### Speed sparkline

Mini inline chart showing speed trend across last N calls. Rendered as block-char sparkline (e.g., `▁▃▅▇▆▄▂`).

### Per-sub-agent speed

Extend "Agents" section with per-child speed rows. Uses full turn duration only (child sessions do not run the main-session TTFT tracker).

### Related modules

| File | Role |
|------|------|
| `src/token-speed.ts` | Speed + streaming phase logic |
| `src/sparkline.ts` | Sparkline rendering |
| `src/first-part-time.ts` | TTFT tracker (sidebar + timeline) |
| `src/use-cache-hit-metrics.ts` | Last / Avg / TTFT memos |
| `src/main-session-view.tsx` | Speed section UI |
| `src/sidebar-host.tsx` | Streaming poll, sub-agent speed |
| `src/agents-view.tsx` | Per sub-agent speed row |
| `src/stats.ts` | `toSubAgentSummary()` speed field |
| `src/types.ts` | `StreamPart`, `SubAgentSummary.speed` |
| `src/i18n.ts` | Speed strings incl. `streamingIdle` |
| `src/plugin-config.ts` | `display.showSpeed` |

---

## 3. Configuration

```json
{
  "display": {
    "showSpeed": true
  }
}
```

| Field | Default | Meaning |
|-------|---------|---------|
| `showSpeed` | `true` | Show/hide speed section |

---

## 4. UI layout

Placement: between **Detail** and **Model** sections.

```
┌─ Cache Hit ─────────────────────────────┐
│ ▼ Hit [████████░░] 82.5% ↑5.2          │
│ Total Hit: 82.2%                         │
│ TTL: 3m 12s                              │
│                                          │
│ ▼ Detail                                 │
│   Read:  125.0K tok                      │
│   Write: 8.2K tok                        │
│   ...                                    │
│                                          │
│ ▼ Speed                                  │
│   Now: 52 tok/s                          │  ← streaming (idle: ·)
│   Last: 48 tok/s                         │
│   Avg:  42 tok/s                         │
│   Trend: ▁▃▅▇▆▄▂                        │
│   TTFT: 944ms                            │  ← last completed call (or "—")
│                                          │
│ ▼ Model                                  │
│   Cost: $0.20                            │
│   Model: claude-sonnet-4-20250514        │
│   ...                                    │
│                                          │
│ ▼ Agents (2) · sub-sessions              │
│   deepseek-v4-f… …cgy1  $0.092          │
│                     101 tok/s            │
│   deepseek-v4-f… …auBU  $0.044          │
│                      96 tok/s            │
└──────────────────────────────────────────┘
```

---

## 5. Risks & dependencies

| Risk | Impact | Mitigation |
|------|--------|------------|
| `api.state.part()` unavailable | **Now** cannot estimate (warmup / `·`) | **Last** / **Avg** still use real tokens; see [TTFT troubleshooting](./ttft-troubleshooting.md) |
| Missing plugin SDK fields | Some metrics empty | Optional chaining; missing rows show `"—"` (not **Now** idle) |
| Very short completed turns | **Last** / **Avg** show `<1 tok/s` | `computeTokenSpeed` returns 0 when `durationMs < 500` |
| `setInterval` polls every 1s | Very lightweight | Idle ticks update phase (`·`); reads `part()` only while streaming |

**`—` usage (aligned with §2):** **Now** idle is `·`; `—` is for metrics without reliable data (e.g. TTFT), not streaming idle.

---

## 6. Streaming **Now** algorithm

### Current: cumulative average since first token (shipped)

`estimateStreamingSpeed()` in `src/token-speed.ts`:

```
start = firstPartTime (> created) ?? msg.time.created
speed ≈ (text.length / 4) / ((now - start) / 1000)
```

Polled every 1s via `api.state.part()`. When `firstPartTime` is tracked (same hybrid TTFT tracker as timeline / **TTFT** row), the denominator starts at first token — **Now** reflects generation speed, excluding TTFT wait. Falls back to `msg.time.created` until the first stream part is recorded. This is a **turn-average since first output**, not an instantaneous rate.

**Why this default**

- Simple — no per-message sample buffer
- Stable numbers in a TUI sidebar (little flicker)
- Complements **Last** / **Avg** (real token counts after completion)
- Same char/4 pattern as MiMo-Code reference; TTFT excluded like opencode-hud / throughput plugins

**Trade-offs**

- Until first token is tracked, denominator still uses `created` (warmup / TTFT phase)
- Pauses mid-stream (tool calls, thinking gaps) pull the average down slowly rather than dropping sharply
- char/4 error on mixed CN/EN, code, reasoning (shared with any text-based estimate)

### Alternative: sliding window (not implemented)

Measure speed over a recent window Δt (e.g. 1–3s):

```
speed ≈ (Δchars / 4) / Δt
```

Samples from periodic polls or `message.part.delta` events (ring buffer of `(timestamp, charCount)` per in-flight message).

| | Cumulative (current) | Sliding window |
|--|---------------------|----------------|
| Meaning | Average since first token (TTFT excluded when tracked) | Near-instantaneous rate |
| Stability | High | Lower; may need EMA smoothing |
| Stalls | Slow decay | Fast drop when output stops |
| Bursts | Diluted by history | Visible in short windows |
| State | Minimal | Per-message last sample or buffer |
| Tool / think gaps | Average keeps falling | Window may show ~0 unless handled |

**When to reconsider sliding window:** if users need stall/burst visibility or **Now** should track **Last** more closely during streaming. Not required for the current observability sidebar scope.
