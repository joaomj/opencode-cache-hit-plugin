import { describe, test, expect } from "bun:test"
import { existsSync } from "node:fs"
import { join } from "node:path"
import { CONFIG_PATH, PLUGIN_ROOT, XDG_CONFIG_PATH, loadPluginConfig } from "../src/load-config.ts"

describe("load-config paths", () => {
  test("PLUGIN_ROOT is package root", () => {
    expect(existsSync(join(PLUGIN_ROOT, "cache-hit.config.example.json"))).toBe(true)
    expect(existsSync(join(PLUGIN_ROOT, "index.tsx"))).toBe(true)
    expect(CONFIG_PATH).toBe(join(PLUGIN_ROOT, "cache-hit.config.json"))
  })

  test("XDG_CONFIG_PATH is outside cache dir", () => {
    expect(XDG_CONFIG_PATH).toInclude(".config/opencode/cache-hit.json")
    expect(XDG_CONFIG_PATH).not.toInclude(".cache")
  })

  test("loads config from repo cache-hit.config.json when XDG config is absent", () => {
    if (!existsSync(CONFIG_PATH)) return
    const cfg = loadPluginConfig()
    expect(cfg.timeline.enabled).toBe(true)
  })

  test("returns defaults when neither config exists", () => {
    const cfg = loadPluginConfig()
    expect(cfg.display.lang).toBeTruthy()
  })

  test("cloneDefault includes cacheTTL — regression for crash on config.providers access", () => {
    // When no config file is present, loadPluginConfig() falls through to cloneDefault().
    // Previously cacheTTL was omitted from cloneDefault(), causing a TUI crash:
    //   TypeError: undefined is not an object (evaluating 'config.providers')
    // in CacheTTLView > getTTL.
    const cfg = loadPluginConfig()
    expect(cfg.cacheTTL).toBeDefined()
    expect(cfg.cacheTTL.providers).toBeDefined()
    expect(typeof cfg.cacheTTL.enabled).toBe("boolean")
  })
})
