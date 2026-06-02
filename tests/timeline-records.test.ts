import { describe, test, expect } from "bun:test"
import { messageKeyFor } from "../src/timeline/records.ts"

describe("messageKeyFor", () => {
  test("prefers id", () => {
    expect(
      messageKeyFor({ role: "assistant", id: "m1", time: { created: 1 } }, "s"),
    ).toBe("s:m1")
  })

  test("falls back to created and model", () => {
    expect(
      messageKeyFor(
        { role: "assistant", modelID: "gpt", time: { created: 1000 } },
        "s",
      ),
    ).toBe("s:1000:gpt")
  })
})
