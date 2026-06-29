import { describe, expect, test } from "bun:test"
import { createItlTracker } from "../src/itl-tracker.ts"

describe("createItlTracker", () => {
  test("returns undefined when no chunks tracked", () => {
    const tracker = createItlTracker()
    expect(tracker.getQuantiles("m1")).toBeUndefined()
  })

  test("returns undefined when only one chunk tracked", () => {
    const tracker = createItlTracker()
    tracker.trackChunk("m1")
    expect(tracker.getQuantiles("m1")).toBeUndefined()
  })

  test("computes P50/P90 from inter-chunk intervals", () => {
    const tracker = createItlTracker()
    tracker.trackChunk("m1", 1000)
    tracker.trackChunk("m1", 1050)
    tracker.trackChunk("m1", 1080)
    tracker.trackChunk("m1", 1090)
    tracker.trackChunk("m1", 1150)
    const q = tracker.getQuantiles("m1")
    expect(q).toBeDefined()
    expect(q!.count).toBe(4)
    expect(q!.p50).toBe(30)
    expect(q!.p90).toBe(60)
  })

  test("tracks per-message independently", () => {
    const tracker = createItlTracker()
    tracker.trackChunk("m1", 1000)
    tracker.trackChunk("m1", 1100)
    tracker.trackChunk("m2", 2000)
    expect(tracker.getQuantiles("m1")).toBeDefined()
    expect(tracker.getQuantiles("m2")).toBeUndefined()
  })

  test("reset clears all state", () => {
    const tracker = createItlTracker()
    tracker.trackChunk("m1", 1000)
    tracker.trackChunk("m1", 1100)
    tracker.reset()
    expect(tracker.getQuantiles("m1")).toBeUndefined()
  })

  test("filters out zero deltas", () => {
    const tracker = createItlTracker()
    tracker.trackChunk("m1", 1000)
    tracker.trackChunk("m1", 1000)
    tracker.trackChunk("m1", 1100)
    const q = tracker.getQuantiles("m1")
    expect(q!.count).toBe(1)
    expect(q!.p50).toBe(100)
    expect(q!.p90).toBe(100)
  })
})
