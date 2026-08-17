import type { ModelCost } from "../types.ts"

/** 24h 时间窗口，单位：当天分钟数 [start, end)。end <= start 表示跨天（end 属次日）。 */
export type TimeWindow = {
  start: number
  end: number
}

/** 一个时段档（如 peak / offpeak）及其时间窗口。 */
export type ScheduleLevel = {
  level: string
  windows: TimeWindow[]
}

export type DynamicPricingSchedule = ScheduleLevel[]

/**
 * 单模型计价规则。
 * - `levels`：绝对价（level 名 → USD/1M 四率），优先于倍率。
 * - `multipliers`：相对 `state.provider` 静态价的倍率（如 offpeak 0.5）。
 * - `contextThreshold`：覆盖全局上下文分档阈值（token 数）。
 */
export type ModelPricingRule = {
  /**
   * 绝对价（level 名 → USD/1M 四率），优先于倍率。
   * `currency` 指定 levels 的原始币种（默认 USD）；非 USD 在配置加载时按
   * `cost.rate` 换算为内部 USD 口径（CNY ÷ rate）。
   */
  levels?: Record<string, ModelCost>
  multipliers?: Record<string, number>
  contextThreshold?: number
  /** levels 绝对价的币种：USD（默认）| CNY | EUR | GBP | JPY。 */
  currency?: string
  /** USD → levels 币种 的汇率（用于非 USD levels 换算，如 CNY 填 6.77）；
   * 缺省仅在 currency === 展示币种时按 cost.rate 推断，否则告警并视作 USD。 */
  rate?: number
}

export type DynamicPricingConfig = {
  /** 总开关。默认 true（仅对 DeepSeek 模型应用内置时段规则 + 读取 context_over_200k 分档）。 */
  enabled: boolean
  /** IANA 时区名，如 "Asia/Shanghai"。空 → 系统时区。 */
  timezone: string
  schedule: DynamicPricingSchedule
  /** 全局上下文分档阈值（token 数），默认 200_000。 */
  contextThreshold: number
  providers: Record<string, { models: Record<string, ModelPricingRule> }>
}

export const DEFAULT_SCHEDULE: DynamicPricingSchedule = [
  // DeepSeek 官方高峰时段（北京时间）。
  { level: "peak", windows: [{ start: 9 * 60, end: 12 * 60 }, { start: 14 * 60, end: 18 * 60 }] },
  // 其余为空闲时段（跨天窗口覆盖 18:00 → 次日 09:00 与 12:00 → 14:00）。
  { level: "offpeak", windows: [{ start: 18 * 60, end: 9 * 60 }, { start: 12 * 60, end: 14 * 60 }] },
]

export const DEFAULT_DYNAMIC_PRICING: DynamicPricingConfig = {
  enabled: true,
  timezone: "Asia/Shanghai",
  schedule: DEFAULT_SCHEDULE,
  contextThreshold: 200_000,
  providers: {},
}
