import { describe, test, expect } from "bun:test"
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"

const srcDir = path.resolve(import.meta.dir, "../src")

function collectTsx(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) collectTsx(full, out)
    else if (entry.name.endsWith(".tsx")) out.push(full)
  }
  return out
}

describe("eager-safe JSX (npm plugin loads under bun's generic JSX transform)", () => {
  for (const file of collectTsx(srcDir)) {
    test(path.relative(srcDir, file), () => {
      const code = readFileSync(file, "utf8")
      const problems: string[] = []
      const deref = code.match(/\w+!\s*[.\[]/)
      if (deref) problems.push(`non-null assertion followed by deref: ${deref[0]}`)
      const optChain = code.match(/\?\.\w+\s*[.\[]/)
      if (optChain) problems.push(`optional chain then bare deref: ${optChain[0]}`)
      expect(
        problems,
        `${path.relative(srcDir, file)}: opencode loads this raw TSX with bun's eager JSX (solid transform skips node_modules, see AGENTS.md "Eager-safe JSX"). These patterns throw on undefined before <Show>/<For> guards run. Use ?. / ?? / a local accessor instead.`,
      ).toEqual([])
    })
  }
})
