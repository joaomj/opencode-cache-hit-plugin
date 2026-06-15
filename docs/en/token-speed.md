# Token Speed Sidebar — Design

Feature: display **token generation speed** (tokens/second) in the sidebar panel, alongside existing cache hit rate / token / cost metrics.

## 1. Reference: MiMo-Code sidebar

MiMo-Code's TUI sidebar displays speed using two modes:
- **Streaming**: char-based heuristic (4 chars ≈ 1 token), updated every 1s
- **Completed**: real token counts from `StepFinishPart.tokens`

---

## 2. Features

### Completed-call speed

Display token speed for **finished** LLM calls using real token counts and actual duration.

### Real-time streaming speed

Live speed estimation during streaming using char/4 heuristic. Requires `api.state.part(id)` to access streaming text content. Shows "—" when unavailable.

### Speed sparkline

Mini inline chart showing speed trend across last N calls. Rendered as block-char sparkline (e.g., `▁▃▅▇▆▄▂`).

### Per-sub-agent speed

Extend "Agents" section with per-child speed rows.

### Files changed

| File | Change |
|------|--------|
| `src/token-speed.ts` | **New** — speed calculation functions |
| `src/sparkline.ts` | **New** — sparkline rendering |
| `src/first-part-time.ts` | TTFT tracker (sidebar + timeline) |
| `src/use-cache-hit-metrics.ts` | Speed + TTFT memos |
| `src/main-session-view.tsx` | Speed section UI |
| `src/sidebar-host.tsx` | Streaming tracking, sub-agent speed |
| `src/agents-view.tsx` | Speed row per sub-agent |
| `src/stats.ts` | Extend `toSubAgentSummary()` with speed |
| `src/types.ts` | Add `StreamPart`, `speed` to `SubAgentSummary` |
| `src/i18n.ts` | New speed strings |
| `src/plugin-config.ts` | `display.showSpeed` config |

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
│   Now: 52 tok/s                          │  ← streaming (or "—")
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
| `api.state.part()` not available | Streaming speed not feasible | Show "—" when unavailable |
| Plugin SDK version compatibility | New type fields may not exist | Add optional chaining |
| Speed values fluctuate wildly | Misleading display | Show "—" for calls < 1s |
| `setInterval` performance | 1s polling is lightweight | Only when in-flight message detected |
