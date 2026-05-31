import { describe, test, expect } from "bun:test"
import { themeColorToHex } from "../src/tui-panel/palette.ts"

describe("themeColorToHex", () => {
  test("hex passthrough", () => {
    expect(themeColorToHex("#ff0000", "#000")).toBe("#ff0000")
  })

  test("rgb object", () => {
    expect(themeColorToHex({ r: 255, g: 0, b: 0 }, "#000")).toBe("#ff0000")
  })
})
