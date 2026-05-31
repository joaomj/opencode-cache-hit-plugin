import { existsSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import {
  type PluginConfig,
  normalizePluginConfig,
  DEFAULT_PLUGIN_CONFIG,
} from "./plugin-config.ts"

/** Parent of `src/` (plugin package root). Do not wrap in `dirname` — `..` already resolves there. */
export const PLUGIN_ROOT = fileURLToPath(new URL("..", import.meta.url))
export const CONFIG_PATH = join(PLUGIN_ROOT, "cache-hit.config.json")

function cloneDefault(): PluginConfig {
  return {
    cost: { ...DEFAULT_PLUGIN_CONFIG.cost },
    display: { ...DEFAULT_PLUGIN_CONFIG.display },
    timeline: { ...DEFAULT_PLUGIN_CONFIG.timeline },
  }
}

export function loadPluginConfig(): PluginConfig {
  if (!existsSync(CONFIG_PATH)) return cloneDefault()
  try {
    return normalizePluginConfig(JSON.parse(readFileSync(CONFIG_PATH, "utf8")))
  } catch {
    return cloneDefault()
  }
}
