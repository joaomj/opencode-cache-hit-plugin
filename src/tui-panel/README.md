# TUI panel framework

Reusable OpenCode **sidebar panel** layout (borders, foldable sections, hit bar, theme palette). Inspired by [opencode-visual-cache](https://www.npmjs.com/package/opencode-visual-cache) page structure—no skills, slash commands, or `api.kv` logic.

[中文](README.zh-CN.md) · Design context: [docs/en/design.md](../../docs/en/design.md) § TUI panel framework.

## Quick example

```tsx
/** @jsxImportSource @opentui/solid */
import { createMemo, createSignal, Show } from "solid-js"
import {
  buildPanelPalette,
  createPanelLayout,
  createSectionFold,
  TuiMetricRow,
  TuiPanel,
  TuiPanelNoData,
  TuiPanelSep,
  TuiPanelTitle,
  TuiSection,
} from "./tui-panel/index.ts"

export function MySidebar(props: { theme: Record<string, unknown> }) {
  const pal = createMemo(() => buildPanelPalette(props.theme))
  const [open, setOpen] = createSignal(true)
  const detail = createSectionFold(true)
  const layout = createPanelLayout({ border: () => true })
  const hasData = () => true

  return (
    <TuiPanel pal={pal()} border layout={layout}>
      <TuiPanelTitle
        pal={pal()}
        layout={layout}
        open={open()}
        onToggle={() => setOpen((o) => !o)}
        title="My Panel"
        version="0.2.0"
      />
      <Show when={open()}>
        <Show
          when={hasData()}
          fallback={<TuiPanelNoData pal={pal()} layout={layout} message="No data..." />}
        >
          <TuiPanelSep pal={pal()} layout={layout} />
          <TuiSection
            pal={pal()}
            layout={layout}
            open={detail.open()}
            title="Detail"
            onToggle={detail.toggle}
          >
            <TuiMetricRow pal={pal()} layout={layout} label="Count:" value="42" />
          </TuiSection>
        </Show>
      </Show>
    </TuiPanel>
  )
}
```

## API

| Export | Role |
|--------|------|
| `createPanelLayout` | Width from `onSizeChange`; `gauge`, `row()`, `sep` |
| `createSectionFold` | Section open/closed state |
| `TuiPanel` | Outer border + padding |
| `TuiPanelTitle` | Foldable title; optional `collapsed` summary |
| `TuiSection` | `▼` section header + separator fill |
| `TuiMetricRow` | Label left, value (+ unit) right; optional `labelFg` / `valueFg` for split colors |
| `TuiHitRow` | Hit bar + % + trend |
| `computeHitBarWidth` | Dynamic bar width |

Keep business data, i18n, and stats in your plugin modules; use this package for layout only.

Import `layout.ts` / `palette.ts` directly in tests to avoid pulling JSX through `index.ts`.
