export type CurrencyCode = "USD" | "CNY" | "EUR" | "GBP" | "JPY"

/** How to render msg.cost in the sidebar. */
export type CostDisplayConfig = {
  /** Display currency (symbol / decimals). */
  currency: CurrencyCode
  symbol?: string
  decimals?: number
  minDisplay?: number
  /** Unit of msg.cost from OpenCode (typically USD per opencode.json). */
  costUnit?: CurrencyCode
  /** USD → display currency. Shorthand for convert.rate. */
  rate?: number
  convert?: { from: CurrencyCode; rate: number }
}

export const CURRENCY_PRESETS: Record<CurrencyCode, { symbol: string; decimals: number; minDisplay: number }> = {
  USD: { symbol: "$", decimals: 4, minDisplay: 0.0001 },
  CNY: { symbol: "¥", decimals: 3, minDisplay: 0.01 },
  EUR: { symbol: "€", decimals: 3, minDisplay: 0.01 },
  GBP: { symbol: "£", decimals: 3, minDisplay: 0.01 },
  JPY: { symbol: "¥", decimals: 2, minDisplay: 1 },
}

/** OpenCode msg.cost is USD; show RMB by default. */
export const DEFAULT_COST_DISPLAY: CostDisplayConfig = {
  currency: "CNY",
  costUnit: "USD",
  rate: 6.77,
}

function resolveExchangeRate(cfg: CostDisplayConfig): number {
  if (cfg.convert?.rate && cfg.convert.rate > 0) return cfg.convert.rate
  if (cfg.rate && cfg.rate > 0) return cfg.rate
  const unit = cfg.costUnit ?? "USD"
  if (unit === cfg.currency) return 1
  return 1
}

export function normalizeCostDisplay(raw: unknown): CostDisplayConfig {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_COST_DISPLAY }
  const o = raw as Record<string, unknown>
  const currency =
    typeof o.currency === "string" && o.currency in CURRENCY_PRESETS
      ? (o.currency as CurrencyCode)
      : DEFAULT_COST_DISPLAY.currency

  const cfg: CostDisplayConfig = { currency }

  if (typeof o.symbol === "string" && o.symbol.length > 0) cfg.symbol = o.symbol
  if (typeof o.decimals === "number" && o.decimals >= 0) cfg.decimals = o.decimals
  if (typeof o.minDisplay === "number" && o.minDisplay > 0) cfg.minDisplay = o.minDisplay

  if (typeof o.costUnit === "string" && o.costUnit in CURRENCY_PRESETS) {
    cfg.costUnit = o.costUnit as CurrencyCode
  }

  if (typeof o.rate === "number" && o.rate > 0) cfg.rate = o.rate

  const c = o.convert
  if (c && typeof c === "object") {
    const co = c as Record<string, unknown>
    if (typeof co.from === "string" && co.from in CURRENCY_PRESETS && typeof co.rate === "number" && co.rate > 0) {
      cfg.convert = { from: co.from as CurrencyCode, rate: co.rate }
    }
  }

  if (!cfg.costUnit && !cfg.convert) cfg.costUnit = DEFAULT_COST_DISPLAY.costUnit
  if (!cfg.rate && !cfg.convert?.rate && cfg.costUnit !== cfg.currency) {
    cfg.rate = DEFAULT_COST_DISPLAY.rate
  }

  return cfg
}

export function createCostFormatter(config: CostDisplayConfig): (amountUsd: number) => string {
  const preset = CURRENCY_PRESETS[config.currency]
  const symbol = config.symbol ?? preset.symbol
  const decimals = config.decimals ?? preset.decimals
  const minDisplay = config.minDisplay ?? preset.minDisplay
  const unit = config.costUnit ?? config.convert?.from ?? "USD"
  const rate = unit === config.currency ? 1 : resolveExchangeRate(config)

  return (amount: number) => {
    if (amount <= 0) return ""
    const v = amount * rate
    if (v < minDisplay) return `<${symbol}${minDisplay}`
    return "~" + symbol + v.toFixed(decimals)
  }
}

export function createRateFormatter(config: CostDisplayConfig): (perMillion: number) => string {
  const preset = CURRENCY_PRESETS[config.currency]
  const symbol = config.symbol ?? preset.symbol
  const unit = config.costUnit ?? config.convert?.from ?? "USD"
  const rate = unit === config.currency ? 1 : resolveExchangeRate(config)

  return (perMillion: number) => {
    const v = perMillion * rate
    return symbol + v.toFixed(2)
  }
}
