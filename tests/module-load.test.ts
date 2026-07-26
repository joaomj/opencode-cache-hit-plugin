import { describe, test, expect } from "bun:test"

/**
 * Smoke tests: load modules on the real import graph.
 * Unit tests often import symbols from the file where they live; after a move,
 * consumers can still point at the old path while isolated tests stay green.
 */
describe("module load (import graph)", () => {
  test("use-cache-hit-metrics resolves all named imports", async () => {
    const mod = await import("../src/use-cache-hit-metrics.ts")
    expect(mod.useCacheHitMetrics).toBeTypeOf("function")
  })

  test("format-cache-ui does not re-export layout helpers", async () => {
    const mod = await import("../src/format-cache-ui.ts")
    expect("computeHitBarWidth" in mod).toBe(false)
  })

  test("cache-ttl resolves pure-logic named imports", async () => {
    const mod = await import("../src/cache-ttl.ts")
    expect(mod.getTTL).toBeTypeOf("function")
    expect(mod.formatElapsed).toBeTypeOf("function")
    expect(mod.DEFAULT_TTL_MS).toBeTypeOf("number")
    expect(mod.BUILT_IN_TTL).toBeTypeOf("object")
  })
})
