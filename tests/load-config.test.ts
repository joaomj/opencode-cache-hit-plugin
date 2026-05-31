import { describe, test, expect } from "bun:test"
import { existsSync } from "node:fs"
import { join } from "node:path"
import { CONFIG_PATH, PLUGIN_ROOT, loadPluginConfig } from "../src/load-config.ts"

describe("load-config paths", () => {
  test("PLUGIN_ROOT is package root (contains cache-hit.config.json)", () => {
    expect(existsSync(join(PLUGIN_ROOT, "cache-hit.config.json"))).toBe(true)
    expect(CONFIG_PATH).toBe(join(PLUGIN_ROOT, "cache-hit.config.json"))
  })

  test("loads timeline.enabled from repo config when present", () => {
    if (!existsSync(CONFIG_PATH)) return
    const cfg = loadPluginConfig()
    expect(cfg.timeline.enabled).toBe(true)
  })
})
