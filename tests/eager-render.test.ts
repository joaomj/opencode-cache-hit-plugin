import { describe, test, expect } from "bun:test"
import { testRender } from "@opentui/solid"
import { TuiHitRow } from "../src/tui-panel/components.tsx"

/**
 * Regression guard for opencode#5/#6: npm-installed plugins live under
 * node_modules, where opencode/opentui skip babel-preset-solid, so bun's
 * generic JSX (jsxDEV) eagerly evaluates <Show> children before the guard
 * runs. bun test loads this raw TSX the same way (no solid transform), so
 * rendering with an undefined optional prop must not throw.
 */
describe("eager render smoke (npm plugin load path)", () => {
  test("TuiHitRow renders without optional feature props", async () => {
    await expect(
      testRender(() =>
        TuiHitRow({
          label: "Hit",
          bar: "||",
          pct: "50%",
          barColor: "blue",
          textColor: "white",
        }),
      ),
    ).resolves.toBeDefined()
  })
})
