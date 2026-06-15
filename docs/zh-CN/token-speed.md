# Token 速度侧边栏 — 设计

功能：在侧边栏面板中显示 **token 生成速度**（tokens/秒），与现有的缓存命中率 / token / 费用指标并列。

## 1. 参考：MiMo-Code 侧边栏

MiMo-Code 的 TUI 侧边栏使用两种模式显示速度：
- **流式传输中**：基于字符的启发式估算（4 字符 ≈ 1 token），每秒更新
- **完成后**：使用 `StepFinishPart.tokens` 的真实 token 数

---

## 2. 功能特性

### 已完成调用的速度

展示**已完成** LLM 调用的 token 速度，使用真实 token 数。当 `firstPartTime` 已跟踪（与 TTFT 共用的 hybrid tracker）时，**最近**、**平均**与 sparkline 使用生成阶段耗时（首 token → 完成），不含 TTFT；否则回退为整轮时长（`completed - created`）。

### 实时流式速度

流式传输期间的实时速度估算，使用 char/4 启发式。需要 `api.state.part(id)` 访问流式文本内容。

**实时** 行状态：

| 状态 | 显示 | 颜色 |
|------|------|------|
| 空闲（无流式） | `·` | muted |
| 预热（TTFT 等待、距起点 &lt;500ms 或尚无文本） | `<1 tok/s` | success |
| 流式中 | `N tok/s` | success |
| 保持（流式结束后 2 秒） | 上次 `N tok/s` | muted |

`—` 保留给无数据的指标（如首Token），不用于流式空闲。

### 速度迷你图（Sparkline）

微型内联图表，展示最近 N 次调用的速度趋势。渲染为方块字符迷你图（如 `▁▃▅▇▆▄▂`）。

### 子 Agent 速度

扩展"子 Agent"区域，为每个子会话添加速度行。仅使用整轮时长（子 session 未接入主 session 的 TTFT tracker）。

### 相关模块

| 文件 | 职责 |
|------|------|
| `src/token-speed.ts` | 速度计算与流式 phase 逻辑 |
| `src/sparkline.ts` | 迷你图渲染 |
| `src/first-part-time.ts` | TTFT tracker（侧边栏 + timeline） |
| `src/use-cache-hit-metrics.ts` | 最近 / 平均 / TTFT |
| `src/main-session-view.tsx` | 速度区域 UI |
| `src/sidebar-host.tsx` | 流式轮询、子 Agent 速度 |
| `src/agents-view.tsx` | 子 Agent 速度行 |
| `src/stats.ts` | `toSubAgentSummary()` 的 speed |
| `src/types.ts` | `StreamPart`、`SubAgentSummary.speed` |
| `src/i18n.ts` | 速度文案（含 `streamingIdle`） |
| `src/plugin-config.ts` | `display.showSpeed` |

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
│   实时: 52 tok/s                          │  ← 流式（空闲: ·）
│   最近: 48 tok/s                         │
│   平均: 42 tok/s                          │
│   趋势: ▁▃▅▇▆▄▂                         │
│   首Token: 944ms                         │  ← 最近完成轮次（或 "—"）
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

| 风险 | 影响 | 缓解 |
|------|------|------|
| `api.state.part()` 不可用 | **实时** 无法估算（warmup / `·`） | **最近/平均** 仍用真 token；见 [TTFT 故障排除](./ttft-troubleshooting.md) |
| 插件 SDK 字段缺失 | 部分指标为空 | 可选链；缺数据行用 `"—"`（非 **实时** 空闲） |
| 极短已完成轮次 | **最近/平均** 显示 `<1 tok/s` | `durationMs < 500` 时 `computeTokenSpeed` 返回 0 |
| `setInterval` 每秒轮询 | 极轻量 | 空闲时只更新 phase（`·`）；有流式时读 `part()` |

**`—` 用法（与 §2 一致）**：**实时** 空闲为 `·`；`—` 用于首Token 等无可靠数据的指标，不用于流式空闲。

---

## 6. **实时**速度算法

### 当前：自首 token 起的累积平均（已采用）

`src/token-speed.ts` 中的 `estimateStreamingSpeed()`：

```
start = firstPartTime（> created 时）?? msg.time.created
速度 ≈ (text.length / 4) / ((now - start) / 1000)
```

通过 `api.state.part()` 每秒轮询。当 `firstPartTime` 已记录（与 timeline / **TTFT** 行共用的 hybrid tracker）时，分母从首 token 起算 — **实时**反映生成速度，不含 TTFT 等待。首条 stream part 记录前仍回退到 `msg.time.created`。这是**自首次输出以来的平均速度**，不是瞬时速率。

**作为默认的理由**

- 实现简单 — 无需 per-message 采样缓冲
- TUI 侧边栏数值稳定、少跳动
- 与**最近** / **平均**（完成后的真 token）互补
- 与 MiMo-Code 参考实现同为 char/4 启发式；排除 TTFT，与 opencode-hud / throughput 等插件一致

**代价**

- 首 token 尚未记录时，分母仍用 `created`（warmup / TTFT 阶段）
- 流中停顿（工具调用、长思考）时平均缓慢下降，而非骤降到近 0
- 中英文、代码、reasoning 混排时 char/4 有系统误差（凡基于文本的估算共有）

### 备选：滑窗式（未实现）

在最近 Δt（如 1–3 秒）内度量增量：

```
速度 ≈ (Δchars / 4) / Δt
```

由定时轮询或 `message.part.delta` 打点，对每个进行中的消息维护 `(时间戳, 字符数)` 环形缓冲。

| | 累积平均（当前） | 滑窗式 |
|--|-----------------|--------|
| 含义 | 自首 token 起的平均（已跟踪时排除 TTFT） | 接近瞬时的速率 |
| 稳定性 | 高 | 较低；可能需要 EMA 平滑 |
| 卡顿 | 缓慢回落 | 无新字时快速走低 |
| 突发加速 | 被历史稀释 | 短窗内更明显 |
| 状态 | 极少 | 需记录上次采样或缓冲 |
| 工具/思考间隙 | 平均持续被拉低 | 窗内无增量时接近 0，需单独语义 |

**何时再考虑滑窗：** 需要明显感知卡顿/突发，或希望流式中 **实时** 更接近完成后的 **最近**。对当前「粗看吞吐」的侧边栏目标非必需。
