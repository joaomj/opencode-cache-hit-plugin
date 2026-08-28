export function formatTokenSpeed(tps: number | undefined): string {
  if (tps === undefined || !Number.isFinite(tps)) return "-"
  if (tps < 1) return "<1 tok/s"
  return `${Math.round(tps)} tok/s`
}
