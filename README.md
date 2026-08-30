# opencode-cache-hit

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

OpenCode TUI sidebar plugin for compact per-session cache and usage metrics.

This project is maintained by [Joao Marcos](https://github.com/joaomj). It is based on the original [opencode-cache-hit project](https://github.com/zhumengzhu/opencode-cache-hit), created by [zhumengzhu](https://github.com/zhumengzhu). It keeps the plugin focused on compact per-session metrics.

## Panel

The panel shows one session only and is limited to the metrics listed below.

- **Cache Hit**: cache-read tokens as a percentage of input plus cache-read tokens
- **Session**: weighted output speed for all completed calls in the session in `tok/s`
- **Input / Output**: input and generated token totals
- **Cache Read / Cache Write**: prompt-cache token totals

Speed uses the first visible text timestamp and the last visible text timestamp
(falls back to completion time when the last text end is not available).
It counts output tokens minus one. It excludes reasoning tokens, tool time,
failed calls, tool-only calls, and samples shorter than 250 milliseconds.

The **Session** value uses total eligible output tokens divided by
total eligible generation time.

## Design References

The speed metrics use ideas from these OpenCode changes:

- [PR #42112](https://github.com/anomalyco/opencode/pull/42112) proposed
  first-to-last-token throughput with output-only counting and sample filters.
- [PR #45265](https://github.com/anomalyco/opencode/pull/45265) added native
  token throughput for OpenCode v2 with stream-completion timing and output-only
  counting.

This plugin applies the first-to-last visible text rule through the current
plugin API and provides the session aggregate.

## Install

Use this project from a local checkout:

1. Clone `https://github.com/joaomj/opencode-cache-hit-standalone`.
2. Check out `main`.
3. Add the checkout path to `~/.config/opencode/opencode.json` or `opencode.jsonc`.
4. Restart OpenCode.

Example configuration:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["/path/to/opencode-cache-hit"]
}
```

Copy `cache-hit.config.example.json` to
`~/.config/opencode/cache-hit.json` to configure the panel.

## Configuration

Configuration files accept JSONC. The example file is strict JSON.

### Display

```json
{
  "display": {
    "panelBorder": true
  }
}
```

| Field | Default | Meaning |
|-------|---------|---------|
| `panelBorder` | `true` | Show the panel border |
| `mainHitLabel` | `Cache Hit` | Override the Cache Hit label |

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

Pull the latest changes from `main`, then restart OpenCode.

## Development

```bash
bun test tests/
```

The plugin requires OpenCode TUI plugin slots and the peer packages listed in
`package.json`.

## License

MIT
