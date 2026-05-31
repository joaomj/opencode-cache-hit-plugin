# Contributing

Development, packaging, and npm release notes for **opencode-cache-hit**. User install and configuration: [README.md](README.md) · [README.zh-CN.md](README.zh-CN.md).

## Development

```bash
bun install   # dev: solid-js; peers resolved by OpenCode at runtime
bun test
bun run check
```

Architecture: [docs/en/design.md](docs/en/design.md). After refactors, `tests/module-load.test.ts` catches broken import paths.

Coding agents: [AGENTS.md](AGENTS.md).

After `bun install`, a **pre-push** hook runs `bun test` (skip with `git push --no-verify`). **CI** (GitHub Actions on `main` and PRs) runs the same tests on the server.

## Configuration file (local)

The plugin reads **`cache-hit.config.json`** from the package root (`PLUGIN_ROOT`, same directory as `index.tsx`). Code defaults apply if the file is missing.

| File | In npm tarball? | Purpose |
|------|-----------------|--------|
| `cache-hit.config.example.json` | **Yes** | Template; copy and edit |
| `cache-hit.config.json` | **No** | Your overrides (gitignored here) |
| `logs/` | **No** | Timeline output when enabled |

After OpenCode installs the package (npm or cache):

```bash
cd ~/.cache/opencode/packages/opencode-cache-hit@latest
cp cache-hit.config.example.json cache-hit.config.json
# edit, then restart OpenCode
```

For a **local path** in `tui.json`, put `cache-hit.config.json` in that folder (e.g. `~/.config/opencode/plugins/opencode-cache-hit/`).

## Publishing to npm

Published **as source** (TypeScript / TSX)—**no `dist/` build**. OpenCode loads `index.tsx` via the `./tui` export (same pattern as many TUI plugins).

**Tarball contents** — `package.json` → `"files"`:

- `index.tsx`, `src/`, docs, `cache-hit.config.example.json`, READMEs, `AGENTS.md`, `CONTRIBUTING.md`
- Not included: `tests/`, `logs/`, personal `cache-hit.config.json`, `node_modules/`

**npmjs.com page**

| Source | Effect |
|--------|--------|
| `description` | One-line summary (keep under ~180 chars) |
| `README.md` | Main package page |
| `keywords` | Search tags |
| `LICENSE` | License tab |

`prepublishOnly` runs `bun test`. Set `author` in `package.json` before publish if not already present.

**Release**

```bash
bun test
npm publish --access public   # first time: npm login
```

[opencode-visual-cache](https://www.npmjs.com/package/opencode-visual-cache) ships a `dist/` for its main export but still exposes `./tui` → source; we follow the source-only TUI entry for now.

## Pull requests

- Ensure the [test workflow](.github/workflows/test.yml) passes on your branch.
- Run `bun test` locally (or rely on pre-push / CI).
- User-facing README: update [README.md](README.md) and mirror key points in [README.zh-CN.md](README.zh-CN.md).
- Timeline: update [docs/en/timeline.md](docs/en/timeline.md) and [docs/zh-CN/timeline.md](docs/zh-CN/timeline.md).
