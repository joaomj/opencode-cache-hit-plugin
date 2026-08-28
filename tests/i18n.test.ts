import { describe, test, expect } from "bun:test"
import { resolveLang, getUiStrings } from "../src/i18n.ts"

describe("resolveLang", () => {
  test("defaults to en", () => {
    expect(resolveLang(undefined)).toBe("en")
    expect(resolveLang("en")).toBe("en")
  })

  test("uses English for automatic and unsupported locales", () => {
    expect(resolveLang("auto")).toBe("en")
    expect(resolveLang("fr")).toBe("en")
  })
})

describe("getUiStrings", () => {
  test("english labels use ASCII colon", () => {
    const t = getUiStrings("en")
    expect(t.hit).toBe("Hit")
    expect(t.speed).toBe("Speed:")
    expect(t.lastTurnSpeed).toBe("Last turn:")
    expect(t.sessionSpeed).toBe("Session:")
    expect(t.title).toBe("Cache Hit")
    expect(t.input).toBe("Input:")
    expect(t.read).toBe("Read:")
  })

})
