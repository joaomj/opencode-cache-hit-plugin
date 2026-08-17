import type { ModelCost } from "../types.ts"

/**
 * 上下文分档：contextTokens 超过 threshold 时返回分档价格，否则基础档。
 * threshold 优先用模型自身档位阈值（`cost.contextThreshold`，来自运行时 tier.size）。
 */
export function selectContextRates(
  cost: ModelCost,
  contextTokens: number | undefined,
  threshold = 200_000,
): ModelCost {
  if (!cost.context_over_200k) return cost
  if (contextTokens === undefined) return cost
  const eff = cost.contextThreshold ?? threshold
  return contextTokens > eff ? cost.context_over_200k : cost
}

type RuntimeTier = {
  input: number
  output: number
  cache: { read: number; write: number }
  tier?: { type: "context"; size: number }
}

/**
 * 运行时 cost（`api.state.provider`）→ 插件 ModelCost。
 * opencode 运行时把配置层的 context_over_200k 转为 `tiers[]` / `experimentalOver200K`，
 * 这里归一化回插件字段（含档位阈值 tier.size）。配置层字段已存在时幂等返回。
 */
export function normalizeRuntimeCost(cost: ModelCost): ModelCost {
  if (cost.context_over_200k) return cost
  const raw = cost as ModelCost & {
    tiers?: RuntimeTier[]
    experimentalOver200K?: ModelCost
  }
  if (raw.experimentalOver200K) {
    return { ...cost, context_over_200k: raw.experimentalOver200K, contextThreshold: 200_000 }
  }
  const tier = raw.tiers?.find((t) => t.tier?.type === "context")
  if (tier) {
    return {
      ...cost,
      context_over_200k: {
        input: tier.input,
        output: tier.output,
        cache: { read: tier.cache?.read ?? 0, write: tier.cache?.write ?? 0 },
      },
      contextThreshold: tier.tier?.size ?? 200_000,
    }
  }
  return cost
}

/** 各率乘系数（倍率模式）。系数为 1 时原样返回。 */
export function scaleRates(cost: ModelCost, factor: number): ModelCost {
  if (factor === 1) return cost
  return {
    input: cost.input * factor,
    output: cost.output * factor,
    cache: { read: cost.cache.read * factor, write: cost.cache.write * factor },
    context_over_200k: cost.context_over_200k
      ? {
          input: cost.context_over_200k.input * factor,
          output: cost.context_over_200k.output * factor,
          cache: {
            read: cost.context_over_200k.cache.read * factor,
            write: cost.context_over_200k.cache.write * factor,
          },
        }
      : undefined,
  }
}

/**
 * 用量 → 成本（USD）。`input` 为未命中输入 token（不含缓存，与 opencode 语义一致），
 * 缓存命中部分按 `cacheRead` 单独以 cacheReadRate 计费。
 */
export function billingCost(
  rates: ModelCost,
  input: number,
  output: number,
  cacheRead: number,
  cacheWrite: number,
): number {
  return (
    (input * rates.input +
      output * rates.output +
      cacheRead * rates.cache.read +
      cacheWrite * rates.cache.write) /
    1_000_000
  )
}
