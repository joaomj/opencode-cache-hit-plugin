# Token 速度侧边栏 — 设计

功能：在侧边栏面板中显示 **token 生成速度**（tokens/秒），与现有的缓存命中率 / token / 费用指标并列。

## 1. 参考：MiMo-Code 侧边栏

MiMo-Code 的 TUI 侧边栏使用两种模式显示速度：
- **流式传输中**：基于字符的启发式估算（4 字符 ≈ 1 token），每秒更新
- **完成后**：使用 `StepFinishPart.tokens` 的真实 token 数

---

## 2. 功能特性

### 已完成调用的速度

展示**已完成**的 LLM 调用的 token 速度，使用真实 token 数和实际耗时。

### 实时流式速度

流式传输期间的实时速度估算，使用 char/4 启发式。需要 `api.state.part(id)` 访问流式文本内容。不可用时显示 "—"。

### 速度迷你图（Sparkline）

微型内联图表，展示最近 N 次调用的速度趋势。渲染为方块字符迷你图（如 `▁▃▅▇▆▄▂`）。

### 子 Agent 速度

扩展"子 Agent"区域，为每个子会话添加速度行。

### 涉及文件

| 文件 | 改动 |
|------|------|
| `src/token-speed.ts` | **新建** — 速度计算函数 |
| `src/sparkline.ts` | **新建** — 迷你图渲染 |
| `src/use-cache-hit-metrics.ts` | 新增响应式信号 |
| `src/main-session-view.tsx` | 速度区域 UI |
| `src/sidebar-host.tsx` | 流式跟踪、子 Agent 速度 |
| `src/agents-view.tsx` | 子 Agent 速度行 |
| `src/stats.ts` | 扩展 `toSubAgentSummary()` 添加 speed |
| `src/types.ts` | 添加 `StreamPart`、`SubAgentSummary.speed` |
| `src/i18n.ts` | 新增速度相关字符串 |
| `src/plugin-config.ts` | `display.showSpeed` 配置 |

---

## 3. 配置

```json
{
  "display": {
    "showSpeed": true
  }
}
```

| 字段 | 默认 | 含义 |
|------|------|------|
| `showSpeed` | `true` | 显示/隐藏速度区域 |

---

## 4. UI 布局

位置：**Detail** 和 **Model** 区域之间。

```
┌─ 缓存命中 ─────────────────────────────┐
│ ▼ 命中率 [████████░░] 82.5% ↑5.2      │
│ 总命中: 82.2%                            │
│ 存活: 3m 12s                             │
│                                          │
│ ▼ 明细                                   │
│   缓存读: 125.0K tok                     │
│   缓存写: 8.2K tok                       │
│   ...                                    │
│                                          │
│ ▼ 速度                                   │
│   实时: 52 tok/s                          │  ← 流式（或 "—"）
│   最近: 48 tok/s                         │
│   平均: 42 tok/s                          │
│   趋势: ▁▃▅▇▆▄▂                         │
│                                          │
│ ▼ 模型                                   │
│   费用: $0.20                            │
│   模型: claude-sonnet-4-20250514         │
│   ...                                    │
│                                          │
│ ▼ 子 Agent (2) · 仅子会话               │
│   deepseek-v4-f… …cgy1  ¥0.092          │
│                     101 tok/s            │
│   deepseek-v4-f… …auBU  ¥0.044          │
│                      96 tok/s            │
└──────────────────────────────────────────┘
```

---

## 5. 风险与依赖

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| `api.state.part()` 不可用 | 流式速度不可行 | 不可用时显示 "—" |
| 插件 SDK 版本兼容性 | 新类型字段可能不存在 | 添加可选链 |
| 短时间调用速度值剧烈波动 | 误导性展示 | 调用 < 1s 显示 "—" |
| `setInterval` 性能开销 | 1s 轮询极为轻量 | 仅在有流式消息时启动 |
