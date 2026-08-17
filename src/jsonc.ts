/**
 * Minimal JSONC helpers for Bun scripts and config loading.
 *
 * JSONC here means: regular JSON plus line comments, block comments, and
 * trailing commas before `}` / `]`. Comments inside strings are preserved
 * (including URLs and `//` in string values).
 */

const JSON_WHITESPACE = new Set([" ", "\t", "\n", "\r"])

function withoutTrailingComma(out: string): string {
  let end = out.length
  while (end > 0 && JSON_WHITESPACE.has(out[end - 1])) end--
  return end > 0 && out[end - 1] === "," ? out.slice(0, end - 1) : out
}

/** Strip JSONC comments and trailing commas while preserving string contents. */
export function stripJsonc(src: string): string {
  let out = ""
  let inStr = false
  let esc = false
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    const n = src[i + 1]
    if (inStr) {
      out += c
      if (esc) esc = false
      else if (c === "\\") esc = true
      else if (c === '"') inStr = false
      continue
    }
    if (c === '"') {
      inStr = true
      out += c
      continue
    }
    if (c === "/" && n === "/") {
      while (i < src.length && src[i] !== "\n") i++
      continue
    }
    if (c === "/" && n === "*") {
      i += 2
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i++
      i++
      continue
    }
    if (c === "}" || c === "]") {
      out = withoutTrailingComma(out)
    }
    out += c
  }
  return out
}

/** Parse a JSONC string into `T`. Throws `SyntaxError` for malformed input. */
export function parseJsonc<T>(src: string): T {
  return JSON.parse(stripJsonc(src)) as T
}
