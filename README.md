# opencode-cache-hit

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

OpenCode TUI sidebar plugin for compact per-session cache and usage metrics.

## Panel

The panel shows one session only and is limited to the metrics listed below.

- **Cache Hit**: cache-read tokens as a percentage of input plus cache-read tokens
- **Speed**: weighted completed-call speed in `tok/s`
- **Cost**: the total cost reported by OpenCode for the session
- **Input / Output**: input and generated token totals
- **Cache Read / Cache Write**: prompt-cache token totals

The panel stops refreshing speed when the session has no new completed calls.

## Install

Use the OpenCode command palette:

1. Press `Ctrl+P` and select **install plugin**.
2. Install it for all projects.
3. Install `opencode-cache-hit@latest`.
4. Restart OpenCode.

For a manual install, add the plugin to `~/.config/opencode/tui.json` or
`tui.jsonc`:

```jsonc
{
  "$schema": "https://opencode.ai/tui.json",
  "plugin": ["opencode-cache-hit@latest"]
}
```

Copy `cache-hit.config.example.json` to
`~/.config/opencode/cache-hit.json` to configure the panel.

## Configuration

Configuration files accept JSONC. The example file is strict JSON.

### Cost

```json
{
  "currency": "CNY",
  "costUnit": "USD",
  "rate": 6.77
}
```

| Field | Meaning |
|-------|---------|
| `costUnit` | Currency reported by OpenCode, usually `USD` |
| `currency` | Currency shown in the panel |
| `rate` | Manual conversion rate from `costUnit` to `currency` |

Use `"currency": "USD"` and `"costUnit": "USD"` when conversion is not
needed. Supported display currencies are `USD`, `CNY`, `EUR`, `GBP`, and `JPY`.

### Display

```json
{
  "display": {
    "lang": "en",
    "panelBorder": true
  }
}
```

| Field | Default | Meaning |
|-------|---------|---------|
| `lang` | `"en"` | `en`, `zh`, or `auto` |
| `panelBorder` | `true` | Show the panel border |
| `mainHitLabel` | localized label | Override the Cache Hit label |

### Timeline logs

Timeline logging is optional and disabled by default. When enabled, the plugin
writes one JSONL record per assistant turn. It records session token, cache,
cost, and timing data for local analysis.

```json
{
  "timeline": {
    "enabled": true,
    "dir": "",
    "maxMemoryRows": 50,
    "maxLinesPerFile": 0,
    "rotateMaxBytes": 0,
    "retainRotated": 5,
    "maxAgeDays": 0,
    "maxLogFiles": 0,
    "toolSummary": {
      "allTools": true,
      "bash": false
    }
  }
}
```

Set `toolSummary` to `false` to record timing without tool summaries. Bash
summaries are disabled by default because command input can contain secrets.

## Updating

OpenCode can pin the first package resolved for `@latest`. If an update is not
visible, remove the cached package and reinstall it:

```bash
rm -rf ~/.cache/opencode/packages/opencode-cache-hit@latest
```

## Development

```bash
bun test tests/
```

The plugin requires OpenCode TUI plugin slots and the peer packages listed in
`package.json`.

## License

MIT
