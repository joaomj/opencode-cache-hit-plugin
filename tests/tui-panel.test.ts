import { describe, test, expect } from "bun:test"
import {
  computeHitBarWidth,
  justifyRow,
  padBeforeTitleSummary,
  visualWidth,
} from "../src/tui-panel/layout.ts"
import { formatHitBar } from "../src/format-cache-ui.ts"

describe("justifyRow", () => {
  test("label left and value+unit right on fixed width", () => {
    const w = 28
    const miss = justifyRow("Miss:", "463.9K", w, "tok")
    expect(miss.endsWith("463.9K tok")).toBe(true)
    expect(visualWidth(miss)).toBe(w)
  })
})

describe("computeHitBarWidth", () => {
  test("hit line fits gauge", () => {
    const w = 28
    const barW = computeHitBarWidth("Hit", w)
    const bar = formatHitBar(0.999, barW)
    const hitLine = `Hit [${bar}] 99.9%`
    expect(visualWidth(hitLine)).toBe(w)
    expect(visualWidth(justifyRow("Total Hit:", "98.8%", w))).toBe(w)
  })
})

describe("padBeforeTitleSummary", () => {
  test("non-negative padding", () => {
    expect(padBeforeTitleSummary(28, 0, 10, 12)).toBeGreaterThan(0)
  })
})
