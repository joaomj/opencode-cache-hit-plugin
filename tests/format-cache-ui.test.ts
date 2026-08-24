import { describe, test, expect } from "bun:test"
import {
  formatHitBar,
  formatPercentOneDecimal,
  formatRatioAsPercent,
} from "../src/format-cache-ui.ts"

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
