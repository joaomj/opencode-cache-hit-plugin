import { describe, test, expect } from "bun:test"
import {
  normalizePluginConfig,
  normalizeDisplayConfig,
  DEFAULT_PLUGIN_CONFIG,
} from "../src/plugin-config.ts"

describe("normalizeDisplayConfig", () => {
  test("defaults lang en and panelBorder", () => {
    expect(normalizeDisplayConfig(null).lang).toBe("en")
    expect(normalizeDisplayConfig({}).panelBorder).toBe(true)
  })

  test("parses overrides", () => {
    const d = normalizeDisplayConfig({ mainHitLabel: "Hit", panelBorder: false })
    expect(d.mainHitLabel).toBe("Hit")
    expect(d.panelBorder).toBe(false)
  })

  test("ignores removed showMainSession", () => {
    const d = normalizeDisplayConfig({ showMainSession: false } as Record<string, unknown>)
    expect("showMainSession" in d).toBe(false)
  })
})

describe("normalizePluginConfig", () => {
  test("normalizes display and ignores removed timeline config", () => {
    const c = normalizePluginConfig({
      display: { lang: "auto" },
      timeline: { enabled: true },
    })
    expect(c.display.lang).toBe("auto")
    expect("timeline" in c).toBe(false)
  })
})

describe("deep clone isolation", () => {
  test("normalizePluginConfig(null) does not share nested refs with DEFAULT_PLUGIN_CONFIG", () => {
    const cfg = normalizePluginConfig(null)
    expect(cfg).not.toBe(DEFAULT_PLUGIN_CONFIG)
    expect(cfg.display).not.toBe(DEFAULT_PLUGIN_CONFIG.display)
  })
})
