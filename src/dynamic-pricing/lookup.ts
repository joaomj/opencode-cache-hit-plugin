import type { ModelCost, ProviderInfo } from "../types.ts"
import { normalizeRuntimeCost, selectContextRates, scaleRates } from "./context.ts"
import { DEEPSEEK_DEFAULT_RULE, isDeepSeek } from "./deepseek.ts"
import { isLevelAt } from "./schedule.ts"
import type { DynamicPricingConfig, ModelPricingRule } from "./types.ts"

/** 静态价格查询：providerID + modelID → ModelCost（运行时 tiers 已归一化），未命中返回 null。 */
export function lookupModelCost(
  providers: ReadonlyArray<ProviderInfo>,
  providerID: string | undefined,
  modelID: string | undefined,
): ModelCost | null {
  if (!providerID || !modelID) return null
  for (const p of providers) {
    if (p.id !== providerID) continue
    const model = p.models[modelID]
    return model?.cost ? normalizeRuntimeCost(model.cost) : null
  }
  return null
}

export type PricingLookupContext = {
  now?: number
  contextTokens?: number
  rules?: DynamicPricingConfig
}

export type ResolvedPricing = {
  rates: ModelCost
  /** 命中的时段档名（如 "peak"/"offpeak"）；未启用时段规则时为 undefined。 */
  level?: string
  /** 上下文分档：基础档 "base" 或超阈值档 "over"；模型无分档时 undefined。 */
  contextTier?: "base" | "over"
  /** 是否应用了动态规则（显式配置 / 内置 DeepSeek 默认）。 */
  explicit: boolean
}

function effectiveRule(
  rules: DynamicPricingConfig | undefined,
  providerID: string,
  modelID: string,
): ModelPricingRule | undefined {
  // 总开关关闭 → 完全静态（显式规则、内置默认、context 分档均不生效）。
  if (!rules?.enabled) return undefined
  const explicit = rules.providers[providerID]?.models[modelID]
  if (explicit) return explicit
  // 空 schedule → 无时段可判，不应用内置默认（避免虚假的 ≈ 标记）。
  if (rules.schedule.length > 0 && isDeepSeek(providerID, modelID)) {
    return DEEPSEEK_DEFAULT_RULE
  }
  return undefined
}

function resolveLevel(now: number, rules: DynamicPricingConfig | undefined): string | undefined {
  if (!rules?.enabled) return undefined
  const tz = rules.timezone || "UTC"
  return isLevelAt(now, rules.schedule, tz)
}

function tierOf(cost: ModelCost, tokens: number | undefined, threshold: number): "base" | "over" | undefined {
  if (!cost.context_over_200k || tokens === undefined) return undefined
  const eff = cost.contextThreshold ?? threshold
  return tokens > eff ? "over" : "base"
}

/**
 * 解析模型当前有效价格。优先级：
 * 1. 用户显式 `levels` 绝对价（按时段档，未命中回退静态价）→ 2. 用户显式 `multipliers` 倍率
 * → 3. 内置 DeepSeek 默认倍率 → 4. `state.provider` 静态价（含 context 分档）。
 * `enabled: false` 时所有动态维度关闭，仅返回静态基础价。
 */
export function resolveModelCost(
  providers: ReadonlyArray<ProviderInfo>,
  providerID: string,
  modelID: string,
  ctx: PricingLookupContext = {},
): ResolvedPricing | null {
  const base = lookupModelCost(providers, providerID, modelID)
  if (!base) return null
  // 总开关关闭 → 完全静态基础价（含 context 分档一并关闭），与 README 一致。
  if (ctx.rules && !ctx.rules.enabled) return { rates: base, explicit: false }
  const now = ctx.now ?? Date.now()
  const rules = ctx.rules
  const level = resolveLevel(now, rules)
  const rule = effectiveRule(rules, providerID, modelID)
  // 分档阈值优先级：模型级配置 rule.contextThreshold > 运行时 tier.size（cost.contextThreshold）
  // > 全局 contextThreshold > 默认 200k。统一到 base 上，保证 tierOf 与 selectContextRates 口径一致。
  const effThreshold =
    rule?.contextThreshold ?? base.contextThreshold ?? rules?.contextThreshold ?? 200_000
  const effBase = base.contextThreshold === effThreshold ? base : { ...base, contextThreshold: effThreshold }
  const contextTier = tierOf(effBase, ctx.contextTokens, effThreshold)

  if (rule?.levels) {
    const absolute = level ? rule.levels[level] : undefined
    if (absolute) {
      // 绝对价是完整价格（无 context 分档语义）→ 不标注 context badge，避免误导。
      return { rates: absolute, level, contextTier: undefined, explicit: true }
    }
    // 时段未命中（自定义 schedule 未覆盖当前时刻 / 档位名不匹配）→ 回退静态价，不任意套用第一个档。
    return { rates: selectContextRates(effBase, ctx.contextTokens, effThreshold), level: undefined, contextTier, explicit: true }
  }
  if (rule?.multipliers) {
    const factor = level ? rule.multipliers[level] ?? 1 : 1
    return { rates: scaleRates(selectContextRates(effBase, ctx.contextTokens, effThreshold), factor), level, contextTier, explicit: true }
  }
  // 显式配置了该模型（含仅 contextThreshold）→ 视为动态规则生效。
  return { rates: selectContextRates(effBase, ctx.contextTokens, effThreshold), level, contextTier, explicit: rule !== undefined }
}
