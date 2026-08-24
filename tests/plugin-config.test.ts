import { describe, test, expect } from "bun:test"
import {
  normalizePluginConfig,
  normalizeDisplayConfig,
  normalizeTimelineConfig,
  isToolSummaryEnabled,
  DEFAULT_PLUGIN_CONFIG,
  DEFAULT_TIMELINE,
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

describe("normalizeTimelineConfig", () => {
  test("defaults disabled", () => {
    const t = normalizeTimelineConfig(null)
    expect(t.enabled).toBe(false)
    expect(t.maxMemoryRows).toBe(50)
    expect(t.toolSummary).toEqual({ allTools: true, bash: false })
  })

  test("parses enabled", () => {
    const t = normalizeTimelineConfig({ enabled: true, dir: "/tmp/logs" })
    expect(t.enabled).toBe(true)
    expect(t.dir).toBe("/tmp/logs")
  })

  test("parses toolSummary boolean", () => {
    expect(normalizeTimelineConfig({ toolSummary: false }).toolSummary).toBe(false)
    expect(normalizeTimelineConfig({ toolSummary: true }).toolSummary).toBe(true)
  })

  test("parses toolSummary object", () => {
    const t = normalizeTimelineConfig({
      toolSummary: { allTools: true, bash: false },
    })
    expect(t.toolSummary).toEqual({ allTools: true, bash: false })
  })

  test("toolSummary object defaults allTools to true", () => {
    const t = normalizeTimelineConfig({
      toolSummary: { bash: false, read: true },
    })
    expect(t.toolSummary).toEqual({ allTools: true, bash: false, read: true })
  })

  test("ignores unknown toolSummary keys", () => {
    const t = normalizeTimelineConfig({
      toolSummary: { allTools: false, unknownTool: true },
    })
    expect(t.toolSummary).toEqual({ allTools: false })
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

describe("isToolSummaryEnabled", () => {
  test("boolean true enables all tools", () => {
    expect(isToolSummaryEnabled(true, "bash")).toBe(true)
    expect(isToolSummaryEnabled(true, "read")).toBe(true)
  })

  test("boolean false disables all tools", () => {
    expect(isToolSummaryEnabled(false, "bash")).toBe(false)
    expect(isToolSummaryEnabled(false, "read")).toBe(false)
  })

  test("object with allTools=true enables unlisted tools", () => {
    expect(isToolSummaryEnabled({ allTools: true }, "bash")).toBe(true)
    expect(isToolSummaryEnabled({ allTools: true }, "read")).toBe(true)
  })

  test("object with allTools=false disables unlisted tools", () => {
    expect(isToolSummaryEnabled({ allTools: false }, "bash")).toBe(false)
    expect(isToolSummaryEnabled({ allTools: false }, "read")).toBe(false)
  })

  test("per-tool override takes precedence", () => {
    const setting = { allTools: true, bash: false, read: true }
    expect(isToolSummaryEnabled(setting, "bash")).toBe(false)
    expect(isToolSummaryEnabled(setting, "read")).toBe(true)
    expect(isToolSummaryEnabled(setting, "edit")).toBe(true) // falls back to allTools
  })

  test("per-tool override on disabled allTools", () => {
    const setting = { allTools: false, read: true }
    expect(isToolSummaryEnabled(setting, "bash")).toBe(false)
    expect(isToolSummaryEnabled(setting, "read")).toBe(true)
  })
})

describe("deep clone isolation", () => {
  test("normalizePluginConfig(null) does not share nested refs with DEFAULT_PLUGIN_CONFIG", () => {
    const cfg = normalizePluginConfig(null)
    expect(cfg).not.toBe(DEFAULT_PLUGIN_CONFIG)
    expect(cfg.timeline).not.toBe(DEFAULT_PLUGIN_CONFIG.timeline)
    expect(cfg.timeline.toolSummary).not.toBe(DEFAULT_PLUGIN_CONFIG.timeline.toolSummary)
  })

  test("normalizeTimelineConfig(null) mutations do not pollute DEFAULT_TIMELINE", () => {
    const t = normalizeTimelineConfig(null)
    t.toolSummary = false
    t.enabled = true

    expect(DEFAULT_TIMELINE.toolSummary).toEqual({ allTools: true, bash: false })
    expect(DEFAULT_TIMELINE.enabled).toBe(false)
  })

})
