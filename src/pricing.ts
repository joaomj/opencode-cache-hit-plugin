import type { ModelCost, ProviderInfo, SubAgentSummary } from "./types.ts"

export type PricingInfo = {
  inputRate: number
  outputRate: number
  cacheReadRate: number
  cacheWriteRate: number
  saved: number
}

export const EMPTY_PRICING: PricingInfo = {
  inputRate: 0,
  outputRate: 0,
  cacheReadRate: 0,
  cacheWriteRate: 0,
  saved: 0,
}

export function lookupModelCost(
  providers: ReadonlyArray<ProviderInfo>,
  providerID: string | undefined,
  modelID: string | undefined,
): ModelCost | null {
  if (!providerID || !modelID) return null
  for (const p of providers) {
    if (p.id !== providerID) continue
    const model = p.models[modelID]
    return model?.cost ?? null
  }
  return null
}

export function computePricing(
  providers: ReadonlyArray<ProviderInfo>,
  providerID: string | undefined,
  modelID: string | undefined,
  cacheRead: number,
): PricingInfo {
  const cost = lookupModelCost(providers, providerID, modelID)
  if (!cost) return EMPTY_PRICING
  const inputRate = cost.input
  const outputRate = cost.output
  const cacheReadRate = cost.cache.read
  const cacheWriteRate = cost.cache.write
  const saved =
    inputRate > cacheReadRate ? (cacheRead * (inputRate - cacheReadRate)) / 1_000_000 : 0
  return { inputRate, outputRate, cacheReadRate, cacheWriteRate, saved }
}

export function computeSubsSaved(subs: readonly SubAgentSummary[], providers: ReadonlyArray<ProviderInfo>): number {
  let total = 0
  for (const sub of subs) {
    const p = computePricing(providers, sub.providerID, sub.model, sub.cacheRead)
    total += p.saved
  }
  return total
}
