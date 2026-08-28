export type Lang = "en"

export type UiStrings = {
  title: string
  hit: string
  speed: string
  lastTurnSpeed: string
  sessionSpeed: string
  input: string
  read: string
  write: string
  out: string
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
  lastTurnSpeed: "Last turn:",
  sessionSpeed: "Session:",
  input: "Input:",
  read: "Read:",
  write: "Write:",
  out: "Out:",
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

export function resolveLang(_raw: unknown): Lang {
  return "en"
}

export function getUiStrings(_lang: Lang): UiStrings {
  return EN
}
