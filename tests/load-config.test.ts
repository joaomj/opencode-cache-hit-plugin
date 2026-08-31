import { describe, test, expect } from "bun:test"
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { CONFIG_PATH, PLUGIN_ROOT, XDG_CONFIG_PATH, cloneDefault, loadPluginConfig, tryRead } from "../src/load-config.ts"
import { DEFAULT_PLUGIN_CONFIG } from "../src/plugin-config.ts"

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

  test("returns defaults when neither config exists", () => {
    const cfg = loadPluginConfig()
    expect(cfg.display.lang).toBeTruthy()
  })

  test("cloneDefault returns deep copy — mutations do not pollute DEFAULT_PLUGIN_CONFIG", () => {
    const cfg = cloneDefault()
    cfg.display.lang = "auto"

    expect(cfg.display).not.toBe(DEFAULT_PLUGIN_CONFIG.display)
    expect(DEFAULT_PLUGIN_CONFIG.display.lang).toBe("en")
  })

  test("parses JSONC configs and ignores removed cost fields", () => {
    const dir = mkdtempSync(join(tmpdir(), "cache-hit-"))
    const path = join(dir, "cache-hit.json")
    writeFileSync(
      path,
      [
        "{",
        '  // line comment',
        '  "currency": "USD",',
        '  "costUnit": "USD",',
        '  "display": { "lang": "auto" }, // trailing comma + comment',
        '  /* block comment */ "timeline": { "enabled": false },',
        "}",
      ].join("\n"),
    )
    try {
      const cfg = tryRead(path)
      expect(cfg).not.toBeNull()
      expect("cost" in (cfg ?? {})).toBe(false)
      expect(cfg?.display.lang).toBe("auto")
      expect("timeline" in (cfg ?? {})).toBe(false)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  test("returns null for malformed config content", () => {
    const dir = mkdtempSync(join(tmpdir(), "cache-hit-"))
    const path = join(dir, "bad.json")
    writeFileSync(path, "{ nope")
    try {
      expect(tryRead(path)).toBeNull()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
