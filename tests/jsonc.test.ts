import { describe, test, expect } from "bun:test"
import { parseJsonc, stripJsonc } from "../src/jsonc.ts"

describe("stripJsonc", () => {
  test("removes line comments", () => {
    expect(stripJsonc(`{\n// line comment\n"a": 1}`)).toBe(`{\n"a": 1}`)
  })

  test("removes block comments", () => {
    expect(stripJsonc(`{"a": /* block */ 1}`)).toBe(`{"a":  1}`)
  })

  test("removes trailing commas before objects and arrays", () => {
    expect(stripJsonc(`{"a": 1,}`)).toBe(`{"a": 1}`)
    expect(stripJsonc(`[1, 2, ]`)).toBe(`[1, 2]`)
  })

  test("removes trailing commas when comments sit between comma and close", () => {
    expect(stripJsonc(`{"a": 1, // trailing\n}`)).toBe(`{"a": 1}`)
    expect(stripJsonc(`[1, /* trailing */]`)).toBe(`[1]`)
  })

  test("preserves comment markers inside strings", () => {
    const src = `{"url":"http://example.com/a//b","block":"/* keep */","quote":"\\" // keep"}`
    expect(stripJsonc(src)).toBe(src)
  })

  test("does not treat braces or commas inside strings as JSONC syntax", () => {
    expect(stripJsonc(`{"a":"}","b":","}`)).toBe(`{"a":"}","b":","}`)
  })

  test("keeps a string ending with a comma next to a real trailing comma", () => {
    // Ambiguous case: a string ends with a comma next to a real trailing comma.
    expect(stripJsonc(`{"a": "x,",}`)).toBe(`{"a": "x,"}`)
    expect(stripJsonc(`{"a": {"b": "x,",},}`)).toBe(`{"a": {"b": "x,"}}`)
  })
})

describe("parseJsonc", () => {
  test("parses JSONC into an object", () => {
    expect(
      parseJsonc<{ a: number; b: number[] }>(`{
        // line comment
        "a": 1, /* block comment */
        "b": [1, 2,],
      }`),
    ).toEqual({ a: 1, b: [1, 2] })
  })

  test("preserves escaped quotes and URLs in strings", () => {
    expect(
      parseJsonc<{ url: string; quote: string }>(
        `{"url":"http://example.com/a//b","quote":"say \\"hi\\" // now"}`,
      ),
    ).toEqual({ url: "http://example.com/a//b", quote: 'say "hi" // now' })
  })

  test("throws SyntaxError for malformed JSONC", () => {
    expect(() => parseJsonc(`{"a": 1`)).toThrow(SyntaxError)
    expect(() => parseJsonc(`/* unterminated {"a": 1}`)).toThrow(SyntaxError)
  })
})
