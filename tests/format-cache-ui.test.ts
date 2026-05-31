import { describe, test, expect } from "bun:test"
import {
  formatTrendLabel,
  formatHitBar,
  formatPercentOneDecimal,
  formatRatioAsPercent,
} from "../src/format-cache-ui.ts"

describe("formatTrendLabel", () => {
  test("up, down, and neutral zero", () => {
    expect(formatTrendLabel(0.3)).toBe("\u21910.3%")
    expect(formatTrendLabel(-0.5)).toBe("\u21930.5%")
    expect(formatTrendLabel(0)).toBe("-")
  })
})

describe("formatPercent", () => {
  test("one decimal percent", () => {
    expect(formatPercentOneDecimal(98.76)).toBe("98.7%")
    expect(formatRatioAsPercent(0.988)).toBe("98.8%")
  })
})

describe("formatHitBar", () => {
  test("renders block chars without brackets", () => {
    expect(formatHitBar(1, 4)).toBe("████")
    expect(formatHitBar(0, 4)).toBe("░░░░")
  })
})
