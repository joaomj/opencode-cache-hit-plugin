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
    expect(t.miss).toBe("Miss:")
    expect(t.hit).toBe("Hit")
    expect(t.totalHit).toBe("Total Hit:")
    expect(t.title).toBe("Cache Hit")
    expect(t.read).toBe("Read:")
    expect(t.agentsScopeHint).toContain("sub-session")
  })

  test("chinese agents scope hint", () => {
    expect(getUiStrings("zh").agentsScopeHint).toBe(" · 仅子会话")
  })
})

