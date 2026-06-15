import { describe, expect, test } from "bun:test"
import { formatSparkline, collectSpeedValues } from "../src/sparkline.ts"

describe("formatSparkline", () => {
  test("empty array returns empty string", () => {
    expect(formatSparkline([])).toBe("")
  })

  test("single value returns middle block", () => {
    expect(formatSparkline([42])).toBe("▄")
  })

  test("identical values return middle block", () => {
    expect(formatSparkline([10, 10, 10])).toBe("▄▄▄")
  })

  test("ascending values produce ascending blocks", () => {
    const result = formatSparkline([1, 2, 3, 4, 5, 6, 7, 8])
    expect(result.length).toBe(7)
    expect(result).toContain("▁")
    expect(result).toContain("█")
  })

  test("descending values produce descending blocks", () => {
    const result = formatSparkline([8, 7, 6, 5, 4, 3, 2, 1])
    expect(result.length).toBe(7)
  })

  test("respects width parameter", () => {
    const result = formatSparkline([1, 2, 3, 4, 5], 3)
    expect(result.length).toBe(3)
  })

  test("takes last N values when exceeding width", () => {
    const result = formatSparkline([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 3)
    expect(result.length).toBe(3)
  })
})

describe("collectSpeedValues", () => {
  test("empty records returns empty array", () => {
    expect(collectSpeedValues([])).toEqual([])
  })

  test("skips records without durationMs", () => {
    expect(collectSpeedValues([{ output: 100 }])).toEqual([])
  })

  test("skips records without output", () => {
    expect(collectSpeedValues([{ durationMs: 1000 }])).toEqual([])
  })

  test("skips records with durationMs < 500", () => {
    expect(collectSpeedValues([{ durationMs: 400, output: 100 }])).toEqual([])
  })

  test("computes speed for valid records", () => {
    const result = collectSpeedValues([{ durationMs: 1000, output: 100 }])
    expect(result).toEqual([100])
  })

  test("filters out zero speed", () => {
    expect(collectSpeedValues([{ durationMs: 1000, output: 0 }])).toEqual([])
  })

  test("respects maxPoints parameter", () => {
    const records = [
      { durationMs: 1000, output: 100 },
      { durationMs: 1000, output: 200 },
      { durationMs: 1000, output: 300 },
    ]
    expect(collectSpeedValues(records, 2)).toEqual([200, 300])
  })
})
