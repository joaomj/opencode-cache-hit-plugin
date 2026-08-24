export type Lang = "en" | "zh"

export type UiStrings = {
  title: string
  hit: string
  speed: string
  input: string
  read: string
  write: string
  out: string
  cost: string
  saved: string
  rate: string
  rateIn: string
  rateOut: string
  rateCache: string
  hitFolded: string
  noData: string
  secDetail: string
  tok: string
}

const EN: UiStrings = {
  title: "Cache Hit",
  hit: "Hit",
  speed: "Speed:",
  input: "Input:",
  read: "Read:",
  write: "Write:",
  out: "Out:",
  cost: "Cost:",
  saved: "Saved:",
  rate: "Rate:",
  rateIn: "/M in",
  rateOut: "/M out",
  rateCache: "/M cache",
  hitFolded: "hit",
  noData: "Waiting for cache data...",
  secDetail: "Detail",
  tok: "tok",
}

const ZH: UiStrings = {
  title: "缓存命中",
  hit: "命中率",
  speed: "速度:",
  input: "输入:",
  read: "缓存读:",
  write: "缓存写:",
  out: "输出:",
  cost: "费用:",
  saved: "节省:",
  rate: "单价:",
  rateIn: "/M 输入",
  rateOut: "/M 输出",
  rateCache: "/M 缓存",
  hitFolded: "命中",
  noData: "等待缓存数据...",
  secDetail: "明细",
  tok: "tok",
}

export function resolveLang(raw: unknown): Lang {
  if (raw === "zh" || raw === "cn" || raw === "zh-CN") return "zh"
  if (raw === "en") return "en"
  if (raw === "auto") {
    try {
      return Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase().startsWith("zh") ? "zh" : "en"
    } catch {
      return "en"
    }
  }
  return "en"
}

export function getUiStrings(lang: Lang): UiStrings {
  return lang === "zh" ? ZH : EN
}
