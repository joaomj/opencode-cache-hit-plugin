import { describe, test, expect } from "bun:test"
import { buildPanelPalette } from "../src/tui-panel/palette.ts"
import { visualWidth } from "../src/tui-panel/layout.ts"
import {
  displayModelName,
  formatSubAgentLabel,
  modelFamilyId,
  modelRowColor,
  MODEL_BRAND_HEX,
  MODEL_FAMILY_RULES,
} from "../src/format-model.ts"
import type { SubAgentSummary } from "../src/types.ts"

const pal = buildPanelPalette({})

function parseHex(hex: string): { r: number; g: number; b: number } {
  const h = hex.slice(1)
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}

const sub = (partial: Partial<SubAgentSummary> & Pick<SubAgentSummary, "id">): SubAgentSummary => ({
  model: "",
  providerID: "",
  cost: 0,
  input: 0,
  output: 0,
  reasoning: 0,
  cacheRead: 0,
  cacheWrite: 0,
  ...partial,
})

describe("displayModelName", () => {
  test("strips provider prefix and date tail", () => {
    expect(displayModelName("anthropic/claude-sonnet-4-20250514")).toBe("claude-sonnet-4")
    expect(displayModelName("deepseek-v3.2-flash")).toBe("deepseek-v3.2-flash")
  })
})

describe("modelFamilyId", () => {
  const cases: Array<[string, string, keyof typeof MODEL_BRAND_HEX]> = [
    ["claude-sonnet-4", "anthropic", "claude"],
    ["deepseek-v4-pro", "deepseek", "deepseek"],
    ["gpt-5.5", "openai", "openai"],
    ["gemini-2.5-flash", "google", "gemini"],
    ["qwen3-235b", "qwen", "qwen"],
    ["glm-4.7", "zhipu", "glm"],
    ["kimi-k2", "moonshot", "kimi"],
    ["minimax-m2", "minimax", "minimax"],
    ["grok-4", "x-ai", "grok"],
    ["mimo-v2.5-pro", "", "mimo"],
    ["meta-llama/llama-3.3-70b", "meta", "meta"],
    ["mistral-large", "mistral", "mistral"],
  ]

  for (const [model, providerID, family] of cases) {
    test(`${family} ← ${model}`, () => {
      expect(modelFamilyId(model, providerID)).toBe(family)
    })
  }

  test("built-in table size", () => {
    expect(MODEL_FAMILY_RULES.length).toBe(12)
    expect(Object.keys(MODEL_BRAND_HEX).length).toBe(12)
  })

  test("matching is case-insensitive", () => {
    expect(modelFamilyId("DeepSeek-V4-Pro", "DeepSeek")).toBe("deepseek")
    expect(modelFamilyId("ANTHROPIC/Claude-Sonnet-4", "Anthropic")).toBe("claude")
    expect(modelFamilyId("Qwen3-235B", "Alibaba")).toBe("qwen")
  })
})

describe("formatSubAgentLabel", () => {
  const formatCost = (n: number) => `~¥${n.toFixed(3)}`

  test("model prefix and session tail under budget", () => {
    const label = formatSubAgentLabel(
      sub({ id: "sess-HCde4F", model: "deepseek-v4-pro", providerID: "deepseek", cost: 0.038 }),
      28,
      formatCost,
      "tok",
    )
    expect(label.startsWith("deepseek")).toBe(true)
    expect(label).toMatch(/ …[A-Za-z0-9]{4,6}$/)
  })

  test("narrow gauge keeps model prefix and min id tail", () => {
    const label = formatSubAgentLabel(
      sub({
        id: "child-session-xyz12345",
        model: "deepseek-v3.2-flash",
        providerID: "deepseek",
        cost: 0.12,
      }),
      22,
      (n) => `$${n.toFixed(2)}`,
      "tok",
    )
    expect(label.startsWith("deepsee")).toBe(true)
    expect(label.endsWith(" …2345")).toBe(true)
    expect(visualWidth(label)).toBeLessThanOrEqual(22)
  })
})

describe("modelRowColor", () => {
  test("returns toned hex not panel semantic keys", () => {
    const c = modelRowColor("deepseek-v4-pro", "deepseek", pal)
    expect(c).toMatch(/^#[0-9a-f]{6}$/i)
    expect(c).not.toBe(pal.primary)
    expect(c).not.toBe(pal.success)
  })

  test("deepseek bluer than claude (brand hue)", () => {
    const ds = parseHex(modelRowColor("deepseek-v4-pro", "deepseek", pal))
    const cl = parseHex(modelRowColor("claude-sonnet-4", "anthropic", pal))
    expect(ds.b).toBeGreaterThan(ds.r)
    expect(cl.r).toBeGreaterThan(cl.b)
  })

  test("openai greenish", () => {
    const c = parseHex(modelRowColor("gpt-5.5", "openai", pal))
    expect(c.g).toBeGreaterThan(c.r)
    expect(c.g).toBeGreaterThan(c.b)
  })

  test("unknown provider uses hash fallback", () => {
    const c = modelRowColor("acme-widget-v1", "acme", pal)
    expect(c).toMatch(/^#[0-9a-f]{6}$/i)
    expect(c).not.toBe(pal.success)
  })
})
