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

## Configuration file

The plugin reads config from two locations (priority order):

1. **XDG**: `~/.config/opencode/cache-hit.json` (preferred — persists across plugin updates)
2. **Legacy**: `cache-hit.config.json` beside plugin root (backward compatible)

The XDG path is recommended for npm global installs; the legacy path still works for local installs and existing setups.

| File | In npm tarball? | Purpose |
|------|-----------------|--------|
| `cache-hit.config.example.json` | **Yes** | Template; copy and edit |
| `cache-hit.config.json` | **No** | Legacy plugin-root overrides |
| `logs/` | **No** | Timeline output (default: `~/.local/share/opencode/logs/cache-hit/`) |

After installing:

```bash
cp cache-hit.config.example.json ~/.config/opencode/cache-hit.json
# edit, then restart OpenCode
```

For a **local path** plugin in `~/.config/opencode/plugins/opencode-cache-hit/`, placing `cache-hit.config.json` in that folder also works (matches the legacy fallback).

## Versioning

Follow [Semantic Versioning](https://semver.org/):

| Change | Bump | Example |
|--------|------|---------|
| Bug fix (backward-compatible) | **patch** | `0.1.0` → `0.1.1` |
| New feature (backward-compatible) | **minor** | `0.1.0` → `0.2.0` |
| Breaking change | **major** | `0.2.0` → `1.0.0` |

Default changes (rate, paths) accompanied by new features → minor. Pure bugfixes only → patch.

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

**Release** — tag-driven CI publish, no local `npm publish` needed:

```bash
git tag vX.Y.Z && git push origin vX.Y.Z
```

Pushing a `v*` tag triggers [.github/workflows/publish.yml](.github/workflows/publish.yml): it runs `bun test`, then `npm publish --provenance --access public` (requires the `NPM_TOKEN` repo secret; provenance uses the workflow's OIDC `id-token: write` permission). Check the result with `gh run list --workflow=publish.yml`.

[opencode-visual-cache](https://www.npmjs.com/package/opencode-visual-cache) ships a `dist/` for its main export but still exposes `./tui` → source; we follow the source-only TUI entry for now.

## Pull requests

- Ensure the [test workflow](.github/workflows/test.yml) passes on your branch.
- Run `bun test` locally (or rely on pre-push / CI).
- User-facing README: update [README.md](README.md) and mirror key points in [README.zh-CN.md](README.zh-CN.md).
- Timeline: update [docs/en/timeline.md](docs/en/timeline.md) and [docs/zh-CN/timeline.md](docs/zh-CN/timeline.md).
