import { describe, test, expect } from "bun:test"
import { formatTokenCount } from "../src/format-tokens.ts"

describe("formatTokenCount", () => {
  test("formats scale", () => {
    expect(formatTokenCount(2_500_000)).toBe("2.5M")
    expect(formatTokenCount(12_300)).toBe("12.3K")
    expect(formatTokenCount(999)).toBe("999")
  })
})
