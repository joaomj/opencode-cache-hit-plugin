import { describe, test, expect } from "bun:test"
import { resolveLang, getUiStrings } from "../src/i18n.ts"

describe("resolveLang", () => {
  test("defaults to en", () => {
    expect(resolveLang(undefined)).toBe("en")
    expect(resolveLang("en")).toBe("en")
  })

  test("supports zh", () => {
    expect(resolveLang("zh")).toBe("zh")
  })
})

describe("getUiStrings", () => {
  test("english labels use ASCII colon", () => {
    const t = getUiStrings("en")
    expect(t.hit).toBe("Hit")
    expect(t.speed).toBe("Speed:")
    expect(t.title).toBe("Cache Hit")
    expect(t.input).toBe("Input:")
    expect(t.read).toBe("Read:")
  })

  test("chinese speed label", () => {
    expect(getUiStrings("zh").speed).toBe("速度:")
  })
})
