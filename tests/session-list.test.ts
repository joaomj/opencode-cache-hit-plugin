import { describe, test, expect } from "bun:test"
import {
  childSessionIdsForParent,
  parseSessionListResponse,
} from "../src/session-list.ts"

describe("parseSessionListResponse", () => {
  test("array root", () => {
    expect(parseSessionListResponse([{ id: "a", parentID: "p" }])).toEqual([
      { id: "a", parentID: "p" },
    ])
  })

  test("data wrapper", () => {
    expect(parseSessionListResponse({ data: [{ id: "b" }] })).toEqual([{ id: "b" }])
  })

  test("invalid", () => {
    expect(parseSessionListResponse(null)).toEqual([])
    expect(parseSessionListResponse({})).toEqual([])
  })
})

describe("childSessionIdsForParent", () => {
  test("direct children only", () => {
    const list = [
      { id: "c1", parentID: "main" },
      { id: "c2", parentID: "main" },
      { id: "grand", parentID: "c1" },
      { id: "other", parentID: "x" },
      { id: "orphan" },
    ]
    expect(childSessionIdsForParent(list, "main")).toEqual(["c1", "c2"])
  })

  test("empty parent", () => {
    expect(childSessionIdsForParent([], "main")).toEqual([])
  })
})
