import { describe, test, expect } from "bun:test"
import {
  normalizePluginConfig,
  normalizeDisplayConfig,
  normalizeTimelineConfig,
} from "../src/plugin-config.ts"

describe("normalizeDisplayConfig", () => {
  test("defaults lang en and panelBorder", () => {
    expect(normalizeDisplayConfig(null).lang).toBe("en")
    expect(normalizeDisplayConfig({}).panelBorder).toBe(true)
    expect(normalizeDisplayConfig({ agentsBorder: false }).panelBorder).toBe(false)
  })

  test("parses overrides", () => {
    const d = normalizeDisplayConfig({ mainHitLabel: "累计", panelBorder: false })
    expect(d.mainHitLabel).toBe("累计")
    expect(d.panelBorder).toBe(false)
  })

  test("ignores removed showMainSession", () => {
    const d = normalizeDisplayConfig({ showMainSession: false } as Record<string, unknown>)
    expect("showMainSession" in d).toBe(false)
  })
})

describe("normalizeTimelineConfig", () => {
  test("defaults disabled", () => {
    const t = normalizeTimelineConfig(null)
    expect(t.enabled).toBe(false)
    expect(t.maxMemoryRows).toBe(50)
  })

  test("parses enabled", () => {
    const t = normalizeTimelineConfig({ enabled: true, dir: "/tmp/logs" })
    expect(t.enabled).toBe(true)
    expect(t.dir).toBe("/tmp/logs")
  })
})

describe("normalizePluginConfig", () => {
  test("merges cost and display", () => {
    const c = normalizePluginConfig({
      currency: "CNY",
      costUnit: "USD",
      rate: 7,
      display: { lang: "zh" },
    })
    expect(c.cost.rate).toBe(7)
    expect(c.display.lang).toBe("zh")
    expect(c.timeline.enabled).toBe(false)
  })
})
