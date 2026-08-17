import type { AssistantMessage, ProviderInfo, SubAgentSummary } from "../types.ts"
import { billingCost } from "./context.ts"
import { resolveModelCost } from "./lookup.ts"
import type { DynamicPricingConfig } from "./types.ts"

export type RecomputeResult = {
  /** 按每条消息的请求时刻 + 上下文大小重算的总成本（USD）。 */
  cost: number
  /** 参与重算的消息数（有 tokens 且有价格）。 */
  counted: number
  /** 是否有任何消息应用了动态规则（时段 / 上下文分档 / 倍率）。 */
  dynamic: boolean
}

const EMPTY_RESULT: RecomputeResult = { cost: 0, counted: 0, dynamic: false }

/**
 * 逐条重算会话成本：
 * - 时段：`msg.time.created`（请求发起时刻）→ 命中时段档
 * - 上下文：总输入（`input + cacheRead`，openCode 语义下 input 不含缓存）→ context_over_200k 分档
 * - 用量：input / output / cache.read / cache.write（input 为未命中部分，缓存单独计费）
 * 无法定价的消息（无 tokens 或无模型价格）跳过。所有消息均不可定价 → null。
 */
export function recomputeSessionCost(
  messages: ReadonlyArray<AssistantMessage>,
  providers: ReadonlyArray<ProviderInfo>,
  rules: DynamicPricingConfig | undefined,
): RecomputeResult | null {
  if (!messages.length) return null
  let cost = 0
  let counted = 0
  let dynamic = false
  for (const msg of messages) {
    const tokens = msg.tokens
    if (!tokens) continue
    const input = tokens.input ?? 0
    const output = tokens.output ?? 0
    const cacheRead = tokens.cache?.read ?? 0
    const cacheWrite = tokens.cache?.write ?? 0
    if (input + output + cacheRead + cacheWrite === 0) continue
    const resolved = resolveModelCost(providers, msg.providerID ?? "", msg.modelID ?? "", {
      now: msg.time?.created,
      contextTokens: input + cacheRead,
      rules,
    })
    if (!resolved) continue
    cost += billingCost(resolved.rates, input, output, cacheRead, cacheWrite)
    counted += 1
    if (resolved.explicit) dynamic = true
  }
  if (counted === 0) return null
  return { cost, counted, dynamic }
}

/**
 * 子 agent 成本重算：用聚合 tokens + 会话创建时刻（`sub.created`）近似逐条重算。
 * 无 created 或模型不可定价 → null（调用方回退 msg.cost，不按时段猜测）。
 */
export function recomputeSubAgentCost(
  sub: SubAgentSummary,
  providers: ReadonlyArray<ProviderInfo>,
  rules: DynamicPricingConfig | undefined,
): number | null {
  // 无创建时刻 → 无法按时段定价，回退 msg.cost（调用方处理）。
  if (sub.created === undefined) return null
  const input = sub.input
  const output = sub.output
  const cacheRead = sub.cacheRead
  const cacheWrite = sub.cacheWrite
  if (input + output + cacheRead + cacheWrite === 0) return null
  const resolved = resolveModelCost(providers, sub.providerID, sub.model, {
    now: sub.created,
    contextTokens: input + cacheRead,
    rules,
  })
  if (!resolved) return null
  return resolved.explicit ? billingCost(resolved.rates, input, output, cacheRead, cacheWrite) : null
}

/**
 * timeline 记录离线重算：按记录时刻（`created`）+ 上下文档位重算成本。
 * 无 providerId 时按 modelId 在各 provider 中匹配；不可定价 → null。
 */
export function recomputeRecordCost(
  record: {
    modelId?: string
    providerId?: string
    created?: string
    input?: number
    output?: number
    cacheRead?: number
    cacheWrite?: number
  },
  providers: ReadonlyArray<ProviderInfo>,
  rules: DynamicPricingConfig | undefined,
): number | null {
  const modelId = record.modelId ?? ""
  if (!modelId) return null
  const created = record.created ? Date.parse(record.created) : undefined
  if (!Number.isFinite(created ?? 0)) return null
  const input = record.input ?? 0
  const output = record.output ?? 0
  const cacheRead = record.cacheRead ?? 0
  const cacheWrite = record.cacheWrite ?? 0
  if (input + output + cacheRead + cacheWrite === 0) return null

  const byId = record.providerId
    ? resolveModelCost(providers, record.providerId, modelId, {
        now: created,
        contextTokens: input + cacheRead,
        rules,
      })
    : null
  const resolved =
    byId ??
    (() => {
      for (const p of providers) {
        if (!p.models[modelId]) continue
        const r = resolveModelCost(providers, p.id, modelId, {
          now: created,
          contextTokens: input + cacheRead,
          rules,
        })
        if (r) return r
      }
      return null
    })()
  if (!resolved) return null
  return resolved.explicit ? billingCost(resolved.rates, input, output, cacheRead, cacheWrite) : null
}
