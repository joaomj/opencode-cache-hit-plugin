import type { ModelCost, ProviderInfo, SubAgentSummary } from "./types.ts"
import type { DynamicPricingConfig } from "./dynamic-pricing/types.ts"
import { lookupModelCost, resolveModelCost } from "./dynamic-pricing/lookup.ts"
import { billingCost } from "./dynamic-pricing/context.ts"

export type { ModelCost } from "./types.ts"
export { lookupModelCost } from "./dynamic-pricing/lookup.ts"

export type PricingInfo = {
  inputRate: number
  outputRate: number
  cacheReadRate: number
  cacheWriteRate: number
  saved: number
  /** 命中的时段档名（如 "peak"/"offpeak"）；未启用时段规则时为 undefined。 */
  level?: string
  /** 上下文分档：基础档 "base" 或超阈值档 "over"；模型无分档时 undefined。 */
  contextTier?: "base" | "over"
  /** 是否应用了动态规则（用户配置 / 内置 DeepSeek 默认）。 */
  dynamic: boolean
}

export const EMPTY_PRICING: PricingInfo = {
  inputRate: 0,
  outputRate: 0,
  cacheReadRate: 0,
  cacheWriteRate: 0,
  saved: 0,
  dynamic: false,
}

export type PricingContext = {
  /** 当前时刻（ms），用于时段判定。默认 Date.now()。 */
  now?: number
  /** 上下文大小（token 数），用于 context_over_200k 分档判定。 */
  contextTokens?: number
  /** 动态计价配置；缺省时完全回退静态价。 */
  rules?: DynamicPricingConfig
}

export function computePricing(
  providers: ReadonlyArray<ProviderInfo>,
  providerID: string | undefined,
  modelID: string | undefined,
  cacheRead: number,
  ctx: PricingContext = {},
): PricingInfo {
  const resolved = resolveModelCost(providers, providerID ?? "", modelID ?? "", {
    now: ctx.now,
    contextTokens: ctx.contextTokens,
    rules: ctx.rules,
  })
  if (!resolved) return EMPTY_PRICING
  const cost = resolved.rates
  const inputRate = cost.input
  const outputRate = cost.output
  const cacheReadRate = cost.cache.read
  const cacheWriteRate = cost.cache.write
  const saved =
    inputRate > cacheReadRate ? (cacheRead * (inputRate - cacheReadRate)) / 1_000_000 : 0
  return {
    inputRate,
    outputRate,
    cacheReadRate,
    cacheWriteRate,
    saved,
    level: resolved.level,
    contextTier: resolved.contextTier,
    dynamic: resolved.explicit,
  }
}

export function computeSubsSaved(
  subs: readonly SubAgentSummary[],
  providers: ReadonlyArray<ProviderInfo>,
  ctx: PricingContext = {},
): number {
  let total = 0
  for (const sub of subs) {
    const p = computePricing(providers, sub.providerID, sub.model, sub.cacheRead, {
      ...ctx,
      contextTokens: sub.input + sub.cacheRead,
    })
    total += p.saved
  }
  return total
}
