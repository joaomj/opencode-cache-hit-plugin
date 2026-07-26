import { describe, test, expect } from "bun:test"
import { getTTL, formatElapsed, DEFAULT_TTL_MS, BUILT_IN_TTL } from "../src/cache-ttl.ts"
import type { CacheTTLConfig } from "../src/plugin-config.ts"

const MINUTE = 60_000
const HOUR = 60 * MINUTE

describe("getTTL", () => {
  test("provider:model override wins over provider override", () => {
    const config: CacheTTLConfig = {
      enabled: true,
      providers: { "anthropic:claude-x": "30m", anthropic: "10m" },
    }
    expect(getTTL("anthropic", "claude-x", config)).toBe(30 * MINUTE)
  })

  test("provider override wins over built-in default", () => {
    const config: CacheTTLConfig = { enabled: true, providers: { deepseek: "10m" } }
    expect(getTTL("deepseek", "any", config)).toBe(10 * MINUTE)
  })

  test("falls back to built-in default when provider not configured", () => {
    const config: CacheTTLConfig = { enabled: true, providers: {} }
    expect(getTTL("deepseek", "any", config)).toBe(BUILT_IN_TTL.deepseek)
    expect(getTTL("deepseek", "any", config)).toBe(2 * HOUR)
  })

  test("falls back to DEFAULT_TTL_MS for unknown provider", () => {
    const config: CacheTTLConfig = { enabled: true, providers: {} }
    expect(getTTL("unknown-vendor", "m", config)).toBe(DEFAULT_TTL_MS)
  })

  test("ignores unparseable override and uses built-in", () => {
    const config: CacheTTLConfig = { enabled: true, providers: { deepseek: "garbage" } }
    expect(getTTL("deepseek", "any", config)).toBe(BUILT_IN_TTL.deepseek)
  })

  // Regression for #3: pre-normalize config may arrive undefined / partial.
  test("tolerates undefined config", () => {
    expect(getTTL("deepseek", "any", undefined)).toBe(BUILT_IN_TTL.deepseek)
    expect(getTTL("unknown", "m", undefined)).toBe(DEFAULT_TTL_MS)
  })

  test("tolerates config with undefined providers", () => {
    const config = { enabled: true } as unknown as CacheTTLConfig
    expect(getTTL("deepseek", "any", config)).toBe(BUILT_IN_TTL.deepseek)
    expect(getTTL("unknown", "m", config)).toBe(DEFAULT_TTL_MS)
  })
})

describe("formatElapsed", () => {
  test("clamps non-positive to 0s", () => {
    expect(formatElapsed(0)).toBe("0s")
    expect(formatElapsed(-5)).toBe("0s")
  })

  test("seconds only", () => {
    expect(formatElapsed(45_000)).toBe("45s")
  })

  test("minutes and seconds", () => {
    expect(formatElapsed(90_000)).toBe("1m 30s")
  })

  test("hours and minutes (seconds dropped)", () => {
    expect(formatElapsed(2 * HOUR + 15 * MINUTE + 30_000)).toBe("2h 15m")
  })
})
