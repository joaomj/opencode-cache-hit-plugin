import { describe, test, expect } from "bun:test"
import { createFirstPartTimeTracker } from "../src/first-part-time.ts"
import { createTimelineCollector } from "../src/timeline/collector.ts"
import { DEFAULT_TIMELINE } from "../src/plugin-config.ts"
import type { AssistantMessage } from "../src/types.ts"
import type { LlmCallRecord } from "../src/timeline/types.ts"

function msg(overrides: Partial<AssistantMessage> = {}): AssistantMessage {
  return {
    role: "assistant",
    id: "a1",
    time: { created: 1, completed: 2 },
    tokens: { input: 10 },
    ...overrides,
  } as AssistantMessage
}

function collector(
  opts: Omit<Parameters<typeof createTimelineCollector>[0], "firstPartTime"> & {
    firstPartTime?: ReturnType<typeof createFirstPartTimeTracker>
  },
) {
  const firstPartTime = opts.firstPartTime ?? createFirstPartTimeTracker()
  return createTimelineCollector({ ...opts, firstPartTime })
}

describe("createTimelineCollector (event-driven)", () => {
  test("writes ttftMs when firstPartTime tracker has entry", async () => {
    const ttft = createFirstPartTimeTracker()
    ttft.handlePart("a1", "text", 1500, "server")
    const appended: LlmCallRecord[] = []
    const c = collector({
      config: { ...DEFAULT_TIMELINE, enabled: true },
      getRootSessionId: () => "root1",
      getChildIds: () => [],
      firstPartTime: ttft,
      append: async (_p, rec) => {
        appended.push(rec)
      },
    })
    c.handleMessage("root1", msg({ id: "a1", time: { created: 1000, completed: 3000 } }))
    await new Promise((r) => setTimeout(r, 50))
    expect(appended).toHaveLength(1)
    expect(appended[0].ttftMs).toBe(500)
    expect(appended[0].ttftSource).toBe("server")
  })

  test("disabled is no-op", () => {
    const c = collector({
      config: { ...DEFAULT_TIMELINE, enabled: false },
      getRootSessionId: () => "r",
      getChildIds: () => [],
    })
    c.handleMessage("r", msg())
    expect(c.memoryRecords()).toEqual([])
  })

  test("writes complete message on handleMessage call", async () => {
    const appended: LlmCallRecord[] = []
    const c = collector({
      config: { ...DEFAULT_TIMELINE, enabled: true },
      getRootSessionId: () => "root1",
      getChildIds: () => [],
      append: async (_p, rec) => {
        appended.push(rec)
      },
    })
    c.handleMessage("root1", msg({ id: "a1", cost: 0.1 }))
    await new Promise((r) => setTimeout(r, 50))
    expect(appended).toHaveLength(1)
    expect(appended[0].messageKey).toBe("root1:a1")
    expect(appended[0].isComplete).toBe(true)
  })

  test("skips messages for unrelated sessions", () => {
    const appended: LlmCallRecord[] = []
    const c = collector({
      config: { ...DEFAULT_TIMELINE, enabled: true },
      getRootSessionId: () => "root1",
      getChildIds: () => ["child1"],
      append: async (_p, rec) => {
        appended.push(rec)
      },
    })
    c.handleMessage("unrelated-session", msg({ id: "x" }))
    expect(appended).toHaveLength(0)
  })

  test("skips incomplete messages when flushIncomplete is false", () => {
    const appended: LlmCallRecord[] = []
    const c = collector({
      config: { ...DEFAULT_TIMELINE, enabled: true },
      getRootSessionId: () => "r",
      getChildIds: () => [],
      append: async (_p, rec) => {
        appended.push(rec)
      },
    })
    c.handleMessage("r", msg({ id: "inc", time: { created: 1 } }))
    expect(appended).toHaveLength(0)
  })

  test("writes child session message with correct scope", async () => {
    const appended: LlmCallRecord[] = []
    const c = collector({
      config: { ...DEFAULT_TIMELINE, enabled: true },
      getRootSessionId: () => "root1",
      getChildIds: () => ["child1"],
      append: async (_p, rec) => {
        appended.push(rec)
      },
    })
    c.handleMessage("child1", msg({ id: "c1", cost: 0.05 }))
    await new Promise((r) => setTimeout(r, 50))
    expect(appended).toHaveLength(1)
    expect(appended[0].scope).toBe("child")
    expect(appended[0].rootSessionId).toBe("root1")
  })

  test("does not deduplicate — event-driven contract", () => {
    const appended: LlmCallRecord[] = []
    const c = collector({
      config: { ...DEFAULT_TIMELINE, enabled: true },
      getRootSessionId: () => "r",
      getChildIds: () => [],
      append: async (_p, rec) => {
        appended.push(rec)
      },
    })
    const m = msg({ id: "m1" })
    c.handleMessage("r", m)
    c.handleMessage("r", m)
    c.handleMessage("r", m)
    // Event-driven: no dedup. Each call writes independently.
    // In practice, message.updated fires once per message, so this is safe.
    expect(appended).toHaveLength(3)
  })

  test("resetForRootChange clears memory but not write behavior", () => {
    const c = collector({
      config: { ...DEFAULT_TIMELINE, enabled: true },
      getRootSessionId: () => "r",
      getChildIds: () => [],
    })
    c.handleMessage("r", msg({ id: "m1" }))
    expect(c.memoryRecords()).toHaveLength(1)
    c.resetForRootChange()
    expect(c.memoryRecords()).toEqual([])
    // Can still handle messages after reset
    c.handleMessage("r", msg({ id: "m2" }))
    expect(c.memoryRecords()).toHaveLength(1)
  })

  test("disposed collector ignores messages", () => {
    const appended: LlmCallRecord[] = []
    const c = collector({
      config: { ...DEFAULT_TIMELINE, enabled: true },
      getRootSessionId: () => "r",
      getChildIds: () => [],
      append: async (_p, rec) => {
        appended.push(rec)
      },
    })
    c.dispose()
    c.handleMessage("r", msg())
    expect(appended).toHaveLength(0)
    expect(c.memoryRecords()).toEqual([])
  })

  test("respects logSummaryMessages config", () => {
    const appended: LlmCallRecord[] = []
    const c = collector({
      config: { ...DEFAULT_TIMELINE, enabled: true, logSummaryMessages: false },
      getRootSessionId: () => "r",
      getChildIds: () => [],
      append: async (_p, rec) => {
        appended.push(rec)
      },
    })
    c.handleMessage("r", msg({ id: "sum", summary: true }))
    expect(appended).toHaveLength(0)
    c.handleMessage("r", msg({ id: "normal" }))
    expect(appended).toHaveLength(1)
  })

  test("sets scope to main for root session messages", async () => {
    const appended: LlmCallRecord[] = []
    const c = collector({
      config: { ...DEFAULT_TIMELINE, enabled: true },
      getRootSessionId: () => "root1",
      getChildIds: () => [],
      append: async (_p, rec) => {
        appended.push(rec)
      },
    })
    c.handleMessage("root1", msg({ id: "m1" }))
    await new Promise((r) => setTimeout(r, 50))
    expect(appended).toHaveLength(1)
    expect(appended[0].scope).toBe("main")
  })

  test("skips user messages", () => {
    const appended: LlmCallRecord[] = []
    const c = collector({
      config: { ...DEFAULT_TIMELINE, enabled: true },
      getRootSessionId: () => "r",
      getChildIds: () => [],
      append: async (_p, rec) => {
        appended.push(rec)
      },
    })
    c.handleMessage("r", msg({ role: "user" }))
    expect(appended).toHaveLength(0)
  })

  test("writes incomplete messages when flushIncomplete is true", () => {
    const appended: LlmCallRecord[] = []
    const c = collector({
      config: { ...DEFAULT_TIMELINE, enabled: true, flushIncomplete: true },
      getRootSessionId: () => "r",
      getChildIds: () => [],
      append: async (_p, rec) => {
        appended.push(rec)
      },
    })
    c.handleMessage("r", msg({ id: "inc", time: { created: 1 } }))
    expect(appended).toHaveLength(1)
    expect(appended[0].isComplete).toBe(false)
  })

  test("append failure does not crash collector", () => {
    let called = false
    const c = collector({
      config: { ...DEFAULT_TIMELINE, enabled: true },
      getRootSessionId: () => "r",
      getChildIds: () => [],
      append: async () => {
        called = true
        throw new Error("disk full")
      },
    })
    // Should not throw
    c.handleMessage("r", msg({ id: "m1" }))
    // Append was attempted, record added to memory before async write
    expect(called).toBe(true)
    expect(c.memoryRecords()).toHaveLength(1)
  })

  test("memoryRecords respects maxMemoryRows", () => {
    const c = collector({
      config: { ...DEFAULT_TIMELINE, enabled: true, maxMemoryRows: 2 },
      getRootSessionId: () => "r",
      getChildIds: () => [],
    })
    c.handleMessage("r", msg({ id: "a" }))
    c.handleMessage("r", msg({ id: "b" }))
    c.handleMessage("r", msg({ id: "c" }))
    const records = c.memoryRecords()
    expect(records).toHaveLength(2)
    expect(records[0].messageKey).toContain("b")
    expect(records[1].messageKey).toContain("c")
  })
})
