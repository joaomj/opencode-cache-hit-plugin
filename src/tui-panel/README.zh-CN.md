# TUI 面板框架

OpenCode **侧边栏面板**可复用布局（边框、折叠段、命中率条、主题调色板）。页面结构对齐 [opencode-visual-cache](https://www.npmjs.com/package/opencode-visual-cache)，**不含** skills、斜杠命令、`api.kv` 等业务。

[English](README.md) · 设计背景：[docs/zh-CN/design.md](../../docs/zh-CN/design.md) § TUI 面板框架。

## 快速用法

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
        version="0.1.0"
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

| 导出 | 说明 |
|------|------|
| `createPanelLayout` | `onSizeChange` 测宽；`gauge`、`row()`、`sep` |
| `createSectionFold` | 区块折叠状态 |
| `TuiPanel` | 外框 + padding |
| `TuiPanelTitle` | 可折叠标题；可选 `collapsed` 摘要 |
| `TuiSection` | `▼` 区块标题 + 分隔线填充 |
| `TuiMetricRow` | 左标签右数值（可选 unit） |
| `TuiHitRow` | Hit 条 + % + 趋势 |
| `computeHitBarWidth` | 动态进度条宽度 |

业务数据、i18n、统计逻辑放在插件自己的模块；本目录只负责页面骨架。测试里请直接 import `layout.ts` / `palette.ts`，避免经 `index.ts` 拉入 JSX。
