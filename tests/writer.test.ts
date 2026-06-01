import { describe, test, expect } from "bun:test"
import { homedir } from "node:os"
import { join } from "node:path"
import { resolveTimelineDir, DEFAULT_TIMELINE_DIR } from "../src/timeline/writer.ts"
import type { TimelineConfig } from "../src/plugin-config.ts"

describe("resolveTimelineDir", () => {
  test("empty dir returns default", () => {
    expect(resolveTimelineDir({ dir: "" } as TimelineConfig)).toBe(DEFAULT_TIMELINE_DIR)
  })

  test("nullish dir returns default", () => {
    expect(resolveTimelineDir({} as TimelineConfig)).toBe(DEFAULT_TIMELINE_DIR)
  })

  test("~/ expands to home dir", () => {
    const result = resolveTimelineDir({ dir: "~/logs" } as TimelineConfig)
    expect(result).toBe(join(homedir(), "logs"))
  })

  test("~/ with nested path", () => {
    const result = resolveTimelineDir({ dir: "~/.local/share/cache-hit" } as TimelineConfig)
    expect(result).toBe(join(homedir(), ".local", "share", "cache-hit"))
  })

  test("absolute path returned as-is", () => {
    expect(resolveTimelineDir({ dir: "/var/log/cache-hit" } as TimelineConfig)).toBe("/var/log/cache-hit")
  })

  test("whitespace only returns default", () => {
    expect(resolveTimelineDir({ dir: "   " } as TimelineConfig)).toBe(DEFAULT_TIMELINE_DIR)
  })
})
