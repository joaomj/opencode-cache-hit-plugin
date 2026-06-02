# AGENTS.md — maintainer & AI assistant guide

Instructions for humans and coding agents working in **opencode-cache-hit**. End-user docs: [README.md](README.md) · [README.zh-CN.md](README.zh-CN.md).

## Project purpose

OpenCode TUI sidebar plugin: **cache hit rate**, **tokens**, **cost**, with **sub-agent (child session)** rollup. Optional per-call **JSONL timeline** (`timeline.enabled`).

**Not** a fork of [opencode-visual-cache](https://github.com/Hotakus/opencode-visual-cache). UI patterns and `src/tui-panel/` are **heavily inspired by** visual-cache; product focus differs (see README comparison table).

## Documentation map

| Topic | English | 中文 |
|-------|---------|------|
| Users | [README.md](README.md) | [README.zh-CN.md](README.zh-CN.md) |
| Architecture | [docs/en/design.md](docs/en/design.md) | [docs/zh-CN/design.md](docs/zh-CN/design.md) |
| Timeline / JSONL | [docs/en/timeline.md](docs/en/timeline.md) | [docs/zh-CN/timeline.md](docs/zh-CN/timeline.md) |
| TUI panel | [src/tui-panel/README.md](src/tui-panel/README.md) | [src/tui-panel/README.zh-CN.md](src/tui-panel/README.zh-CN.md) |
| Contributing / npm | [CONTRIBUTING.md](CONTRIBUTING.md) | — |
| Index | [docs/README.md](docs/README.md) | |

## Commands

```bash
bun test          # full unit + module-load smoke
bun run check     # same as test
```

After moving or renaming exports: run full `bun test`; `tests/module-load.test.ts` imports the real consumer graph.

## Code conventions

- **Minimal diffs**; match existing naming and module boundaries.
- **Pure logic** in `stats.ts`, `timeline/`, `format-*.ts`, `format-model.ts`, `tui-panel/layout.ts` — avoid pulling JSX into modules used by tests (import `layout.ts` / `palette.ts` directly, not `tui-panel/index.ts` when possible).
- **Sub-agent row UI**: `format-model.ts` + `agents-view.tsx`; behavior in design doc § Sub-agent row display / 子 session 行展示.
- **`PLUGIN_ROOT`** in `load-config.ts` is `fileURLToPath(new URL("..", import.meta.url))` — do **not** wrap with an extra `dirname` (breaks config path).
- **Sub-agent ids**: only from `session.list` overwrite in `child-session-sync.ts`; do not append via `session.get`.
- **Agents UI totals**: child sessions only; main session excluded by design (see design doc).
- Comments only for non-obvious behavior.

## Configuration

- Example: [cache-hit.config.example.json](cache-hit.config.example.json) — **included in npm** `files`.
- Runtime: `~/.config/opencode/cache-hit.json` (preferred) or `cache-hit.config.json` beside package root (legacy fallback); **not** published; gitignored.
- Defaults: [src/plugin-config.ts](src/plugin-config.ts).
- Timeline log dir default: `~/.local/share/opencode/logs/cache-hit/`. Supports `~/` expansion in `timeline.dir`.

## npm publish

- Tarball = `package.json` `"files"` only (source TSX, example config, docs — no `tests/`, `logs/`, user config).
- No build step required for OpenCode `./tui` entry (`index.tsx`).
- Run `bun test` before `npm publish`; see [CONTRIBUTING.md](CONTRIBUTING.md).

## OpenCode integration

- Entry: [index.tsx](index.tsx) → [src/plugin.tsx](src/plugin.tsx).
- Slot: `sidebar_content`, `order: 56` (near visual-cache).
- Peers: `@opencode-ai/plugin`, `@opencode-ai/sdk`, `@opentui/solid`, `solid-js` (see [package.json](package.json)).

## Git / safety

- Do not `git reset --hard`, `checkout --`, or force-push unless the user explicitly asks.
- Do not commit unless asked; do not commit `logs/` or personal `cache-hit.config.json` if gitignored.

## When adding features

- Prefer config file over slash commands unless parity with visual-cache is an explicit goal.
- Timeline changes: update **both** `docs/en/timeline.md` and `docs/zh-CN/timeline.md`.
- User-facing README changes: update **English README** and mirror key points in **README.zh-CN.md**.
