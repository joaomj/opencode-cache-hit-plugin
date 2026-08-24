export function formatTokenSpeed(tps: number): string {
  if (tps < 1) return "<1 tok/s"
  return `${Math.round(tps)} tok/s`
}
