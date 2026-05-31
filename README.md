# opencode-cache-hit

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

OpenCode **TUI sidebar plugin** for prompt **cache hit rate**, **token usage**, and **cost**—with first-class **sub-agent (child session)** rollup. **Standalone by default** (main + sub-agents in one panel). Optional coexistence with [opencode-visual-cache](https://www.npmjs.com/package/opencode-visual-cache).

**Languages:** English (this file) · [简体中文](README.zh-CN.md) · [Documentation](docs/README.md)

## Why this plugin

[opencode-visual-cache](https://www.npmjs.com/package/opencode-visual-cache) already covers **main-session** cache visualization (token distribution, savings, slash-driven settings). This project exists because that scope does not fit several real workflows:

1. **Sub-agent visibility** — OpenCode spawns child sessions for Task / explore agents; you need **rolled-up** cache, tokens, and cost per sub-session, not only the main thread.
2. **One panel for the whole session** — Main session Hit/tokens/cost **and** a collapsible **Agents** section for sub-agent rollup.
3. **Analysis off the TUI** — Optional **timeline JSONL** (per assistant turn) for charts, jq, and billing post-mortems without scraping platform logs.
4. **Shared TUI building blocks** — `src/tui-panel/` extracted so other sidebar plugins can reuse the same layout language as visual-cache.

Roadmap items (sidebar Timeline section, metric windows, nested sub-agents) are described in [docs/en/timeline.md](docs/en/timeline.md) and [docs/en/design.md](docs/en/design.md).

## Acknowledgments

This plugin is **not** part of opencode-visual-cache. Its sidebar layout, panel components (`src/tui-panel/`), and coexistence patterns are **heavily inspired by** [opencode-visual-cache](https://www.npmjs.com/package/opencode-visual-cache). visual-cache focuses on **main-session context / token distribution**; cache-hit focuses on **per-turn metrics and sub-agent totals**. We recommend installing both.

## Screenshots

![Cache Hit sidebar panel](docs/assets/cache-hit-panel.png)

## Features

- **Cache hit rate**: session total + **per-turn** rate with trend (↑ / ↓ / `-`) on the main block
- **Token breakdown**: cache read / write / miss / output (aligned rows with visual-cache)
- **Cost**: session cost with multi-currency config (`USD`, `CNY`, `EUR`, `GBP`, `JPY`)
- **Sub-agents**: **Agents** section rolls up **child sessions only** (scope labeled in UI)
- **Main + Agents**: main block always shown; **Agents** section when sub-agents exist (foldable)
- **Collapsible sections**: Detail / Model (and Agents); theme-adaptive hit bar colors
- **i18n**: `display.lang` — `en` / `zh` / `auto` via config (no slash commands yet)
- **Timeline** (optional): daily JSONL per assistant turn for `jq` / scripts

## Comparison with [opencode-visual-cache](https://www.npmjs.com/package/opencode-visual-cache)

**Standalone use is the default** (main + sub-agents in one panel). Layout patterns were inspired by visual-cache; that package is **not required**.

| | visual-cache | opencode-cache-hit |
|---|----------------|-------------------|
| Main session context / token **distribution** estimate | Yes | No — use visual-cache |
| Per-role token breakdown (system / tools / …) | Yes | No |
| Cache **savings** estimate | Yes | No |
| Model **per-million** pricing from provider | Yes | Model name + session cost only |
| **Slash commands** (`/cache-lang`, `/cache-currency`, …) | Yes | Config file only |
| Fold state in `api.kv` | Yes | In-session (not persisted) |
| Loaded **skills** panel | Yes | No |
| **Sub-agent** session rollup | No | **Yes** |
| **Combined** hit (main + subs) | No | Yes when sub-agents exist |
| Per-call **JSONL** export | No | Optional `timeline` |

## Quick start

### Option A: OpenCode command palette (recommended)

`Ctrl+P` → **install plugin** → `opencode-cache-hit@latest` (when published) or your local path.

### Option B: Manual

Create or edit `~/.config/opencode/tui.json` / `tui.jsonc`:

```jsonc
{
  "$schema": "https://opencode.ai/tui.json",
  "plugin": ["opencode-cache-hit@latest"]
}
```

Local development: use `"./plugins/opencode-cache-hit"` instead of the npm name.

Copy `cache-hit.config.example.json` → `cache-hit.config.json` next to the plugin root ([Configuration file](#configuration-file)). **Restart OpenCode** after changing plugin code or config.

| Install | After update |
|---------|----------------|
| Local `./plugins/...` | Full restart |
| npm `@latest` | Restart; if UI is stale, remove `~/.cache/opencode/packages/opencode-cache-hit@latest` |

Load errors: `~/.local/share/opencode/log/` (search `cache-hit` or `failed to load tui plugin`).

## Configuration

### Cost display (USD → CNY example)

```json
{
  "currency": "CNY",
  "costUnit": "USD",
  "rate": 7.2
}
```

| Field | Meaning |
|-------|---------|
| `costUnit` | Currency of `msg.cost` (usually `USD`) |
| `currency` | Sidebar display currency |
| `rate` | Multiply `costUnit` → `currency` |

Use `"currency": "USD", "costUnit": "USD"` when no conversion is needed.

Supported display currencies in config: `USD`, `CNY`, `EUR`, `GBP`, `JPY` (see `cache-hit.config.example.json`). Runtime slash switching like visual-cache’s `/cache-currency` is **not** implemented yet.

### Display (`display`)

```json
"display": {
  "lang": "en",
  "panelBorder": true
}
```

| Field | Default | Meaning |
|-------|---------|---------|
| `lang` | `"en"` | `en` / `zh` / `auto` |
| `panelBorder` | `true` | Border/padding |
| `mainHitLabel` | (i18n) | Optional override for the Hit row label |

**Agents** totals sum **child sessions only**, not the main session (see `agentsScopeHint`). Main session metrics stay in the block above; collapse **Agents** to save space.

### Timeline logs (`timeline`, default off)

Per assistant turn → JSONL. [docs/en/timeline.md](docs/en/timeline.md) · [中文](docs/zh-CN/timeline.md).

```json
"timeline": {
  "enabled": true,
  "dir": "",
  "rotateMaxBytes": 16777216,
  "retainRotated": 5,
  "maxAgeDays": 30,
  "maxLogFiles": 20
}
```

| Field | Default | Meaning |
|-------|---------|---------|
| `enabled` | `false` | Master switch |
| `dir` | `""` | `logs/timeline-YYYY-MM-DD.jsonl` under plugin root |
| `rotateMaxBytes` | `0` | Same-day size roll to `.jsonl.1` |
| `retainRotated` | `5` | Backups kept per day |
| `maxLogFiles` | `0` | Cap file count; deletes **earliest** logs first |

```bash
LOG=~/.config/opencode/plugins/opencode-cache-hit/logs/timeline-$(date +%Y-%m-%d).jsonl
tail -f "$LOG"
jq -r 'select(.rootSessionId=="YOUR_ROOT") | [.created,.scope,.hitPercent,.cost]|@tsv' "$LOG"
```

Retention details: [Rotation and retention](docs/en/timeline.md#rotation-and-retention). Charts: [scripts/README.md](scripts/README.md).

## Updating

OpenCode may [cache plugins at first install](https://github.com/anomalyco/opencode/issues/6774) and not auto-refresh npm versions.

```bash
rm -rf ~/.cache/opencode/packages/opencode-cache-hit@latest
```

Then reinstall via `Ctrl+P` → install plugin, and **restart OpenCode**.

## Compatibility

Model-agnostic: any OpenCode provider that exposes assistant `tokens` / `cost` on messages (DeepSeek, Claude, GPT, etc.). Data comes from the OpenCode session API, same as visual-cache.

**Requires** OpenCode with TUI plugin slots (`@opencode-ai/plugin` ≥ 1.14). Works alongside visual-cache; no extra dependencies at runtime beyond peers in [package.json](package.json).

## Documentation

| Audience | English | 中文 |
|----------|---------|------|
| Users | This README | [README.zh-CN.md](README.zh-CN.md) |
| Maintainers | [docs/en/design.md](docs/en/design.md) | [docs/zh-CN/design.md](docs/zh-CN/design.md) |
| Timeline / JSONL | [docs/en/timeline.md](docs/en/timeline.md) | [docs/zh-CN/timeline.md](docs/zh-CN/timeline.md) |
| TUI panel reuse | [src/tui-panel/README.md](src/tui-panel/README.md) | [src/tui-panel/README.zh-CN.md](src/tui-panel/README.zh-CN.md) |
| Contributing / npm | [CONTRIBUTING.md](CONTRIBUTING.md) | — |
| Coding agents | [AGENTS.md](AGENTS.md) | — |
| Index | [docs/README.md](docs/README.md) | |

## Project layout

```
index.tsx
cache-hit.config.example.json
src/
  plugin.tsx              # sidebar_content slot
  sidebar-host.tsx        # messages, child sync, timeline
  widget.tsx
  stats.ts / timeline/ / tui-panel/
tests/
```

## Configuration file

Copy `cache-hit.config.example.json` → `cache-hit.config.json` next to the plugin root (`PLUGIN_ROOT`, same directory as `index.tsx`). Restart OpenCode after edits.

```bash
cd ~/.cache/opencode/packages/opencode-cache-hit@latest   # or your local plugin path
cp cache-hit.config.example.json cache-hit.config.json
```

Details (tarball contents, local paths): [CONTRIBUTING.md](CONTRIBUTING.md).

## Development

```bash
bun test
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, PR notes, and npm publishing. Architecture: [docs/en/design.md](docs/en/design.md).

## License

MIT
