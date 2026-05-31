import { describe, test, expect } from "bun:test"
import { createTimelineCollector } from "../src/timeline/collector.ts"
import { DEFAULT_TIMELINE } from "../src/plugin-config.ts"
import type { AssistantMessage } from "../src/types.ts"
import type { LlmCallRecord } from "../src/timeline/types.ts"

describe("createTimelineCollector", () => {
  test("disabled is no-op", () => {
    const c = createTimelineCollector({
      config: { ...DEFAULT_TIMELINE, enabled: false },
      getRootSessionId: () => "r",
      getChildIds: () => [],
      getMessages: () => [],
    })
    c.schedule()
    expect(c.memoryRecords()).toEqual([])
  })

  test("flushes complete message once", async () => {
    const appended: LlmCallRecord[] = []
    let root = "root1"
    const msgs: AssistantMessage[] = [
      {
        role: "assistant",
        id: "a1",
        time: { created: 1, completed: 2 },
        tokens: { input: 10, cache: { read: 90 } },
        cost: 0.1,
      },
    ]
    const c = createTimelineCollector({
      config: { ...DEFAULT_TIMELINE, enabled: true },
      getRootSessionId: () => root,
      getChildIds: () => [],
      getMessages: (id) => (id === root ? msgs : []),
      append: async (_p, rec) => {
        appended.push(rec)
      },
    })
    c.schedule()
    await new Promise((r) => setTimeout(r, 600))
    expect(appended).toHaveLength(1)
    expect(appended[0].messageKey).toBe("root1:a1")
    expect(appended[0].isComplete).toBe(true)
    c.schedule()
    await new Promise((r) => setTimeout(r, 600))
    expect(appended).toHaveLength(1)
  })

  test("reset does not re-flush same messageKey", async () => {
    const appended: LlmCallRecord[] = []
    const msgs: AssistantMessage[] = [
      {
        role: "assistant",
        id: "x",
        time: { created: 1, completed: 2 },
        tokens: { input: 1 },
      },
    ]
    const c = createTimelineCollector({
      config: { ...DEFAULT_TIMELINE, enabled: true },
      getRootSessionId: () => "r",
      getChildIds: () => [],
      getMessages: () => msgs,
      append: async (_p, rec) => {
        appended.push(rec)
      },
    })
    c.schedule()
    await new Promise((r) => setTimeout(r, 600))
    expect(appended).toHaveLength(1)
    c.resetForRootChange()
    c.schedule()
    await new Promise((r) => setTimeout(r, 600))
    expect(appended).toHaveLength(1)
  })
})
