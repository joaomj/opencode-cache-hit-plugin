import type { ModelPricingRule } from "./types.ts"

/**
 * DeepSeek 官方时段计价：空闲时段价格为高峰时段的一半。
 * 内置默认以"倍率"形式相对 `state.provider` 静态价生效（静态价视为高峰价），
 * 用户可在配置中显式覆盖为绝对价。
 */
export const DEEPSEEK_DEFAULT_RULE: ModelPricingRule = {
  multipliers: { peak: 1, offpeak: 0.5 },
}

/** providerID 或 modelID 是否为 DeepSeek 官方命名空间。 */
export function isDeepSeek(providerID: string, modelID: string): boolean {
  const pid = providerID.toLowerCase()
  const mid = modelID.toLowerCase()
  // provider 名含 deepseek（如 deepseek）或 modelID 以官方前缀 deepseek/ 开头。
  return pid.includes("deepseek") || mid.startsWith("deepseek/")
}
