import assert from "node:assert/strict"
import { describe, test } from "node:test"

import { addDays, startOfDay, startOfWeek } from "date-fns"

import {
  dateMatches,
  libraryParamsFromSearch,
  librarySearch,
  normaliseQuery,
  parseDateClause,
  parseLibraryQuery,
  parseOperator,
  queryText,
  toggleOperator,
  withoutKey,
  withoutOperator,
} from "./library-query"

describe("library search query", () => {
  test("splits operators from free-text terms", () => {
    assert.deepEqual(parseLibraryQuery("  Benchmark type:review project:flue-pi-agent is:open  agents "), {
      terms: ["benchmark", "agents"],
      types: ["review"],
      projects: ["flue-pi-agent"],
      topics: [],
      states: ["open"],
      has: [],
      dates: [],
    })
  })

  test("collects repeated operators once and reads updated:Nd", () => {
    const query = parseLibraryQuery("type:plan type:review type:plan topic:react updated:7d")
    assert.deepEqual(query.types, ["plan", "review"])
    assert.deepEqual(query.topics, ["react"])
    assert.deepEqual(query.dates, [{ kind: "within", days: 7 }])
  })

  test("treats unknown keys and invalid values as search terms", () => {
    assert.equal(parseOperator("type:poster"), null)
    assert.equal(parseOperator("is:closed"), null)
    assert.equal(parseOperator("project:Not_Kebab"), null)
    assert.equal(parseOperator("http://example.com"), null)
    assert.equal(parseOperator(":open"), null)
    assert.equal(parseOperator("is:"), null)
    assert.deepEqual(parseLibraryQuery("type:poster note:x").terms, ["type:poster", "note:x"])
  })

  test("operator keys and values are case-insensitive", () => {
    assert.deepEqual(parseOperator("IS:Open"), { key: "is", value: "open" })
    assert.deepEqual(parseOperator("Type:REVIEW"), { key: "type", value: "review" })
  })

  test("toggles operators while keeping the reader's text", () => {
    assert.equal(toggleOperator("benchmark", { key: "is", value: "open" }), "is:open benchmark")
    assert.equal(toggleOperator("is:open benchmark", { key: "is", value: "open" }), "benchmark")
    assert.equal(
      toggleOperator("type:plan benchmark", { key: "type", value: "review" }, { exclusive: true }),
      "type:review benchmark",
    )
    assert.equal(
      toggleOperator("type:plan", { key: "type", value: "review" }),
      "type:plan type:review",
    )
  })

  test("removes one operator or a whole key", () => {
    assert.equal(withoutOperator("a type:plan b type:review", { key: "type", value: "plan" }), "a b type:review")
    assert.equal(withoutKey("a type:plan is:open type:review", "type"), "a is:open")
    assert.equal(queryText("type:plan agent  runtime is:open"), "agent runtime")
    assert.equal(normaliseQuery("  a   b "), "a b")
  })

  test("parses date and updated as one qualifier, and has:comments", () => {
    const query = parseLibraryQuery("DATE:>7D updated:30d has:comments date:>7d created:2026-01-01 tag:react")
    assert.deepEqual(query.has, ["comments"])
    assert.deepEqual(query.dates, [
      { kind: "after", point: { kind: "ago", days: 7 }, inclusive: false },
      { kind: "within", days: 30 },
    ])
    assert.deepEqual(query.terms, ["created:2026-01-01", "tag:react"])
  })

  test("accepts ranges, comparisons, and named days", () => {
    assert.deepEqual(parseDateClause("2026-01-01..2026-02-01"), {
      kind: "between",
      start: { kind: "day", iso: "2026-01-01" },
      end: { kind: "day", iso: "2026-02-01" },
    })
    assert.deepEqual(parseDateClause(">=2026-10-12"), {
      kind: "after",
      point: { kind: "day", iso: "2026-10-12" },
      inclusive: true,
    })
    assert.deepEqual(parseDateClause("<30d"), { kind: "before", point: { kind: "ago", days: 30 }, inclusive: false })
    assert.deepEqual(parseDateClause("today"), { kind: "today" })
    assert.deepEqual(parseDateClause("week"), { kind: "week" })
    assert.equal(parseDateClause("2026-02-31"), null)
    assert.equal(parseDateClause("yesterday"), null)
    assert.equal(parseDateClause(">"), null)
    assert.equal(parseDateClause("0d"), null)
    assert.equal(parseOperator("updated:yesterday"), null)
    assert.equal(parseOperator("has:labels"), null)
  })

  test("date boundaries are inclusive where the operator says so", () => {
    const now = Date.parse("2026-10-12T12:00:00.000Z")
    const exact = new Date(now - 7 * 86_400_000).toISOString()
    const newer = new Date(now - 6 * 86_400_000).toISOString()
    const older = new Date(now - 8 * 86_400_000).toISOString()
    const clause = (value: string) => parseDateClause(value)!
    assert.equal(dateMatches(exact, clause("7d"), now), true)
    assert.equal(dateMatches(exact, clause(">=7d"), now), true)
    assert.equal(dateMatches(exact, clause(">7d"), now), false)
    assert.equal(dateMatches(exact, clause("<=7d"), now), true)
    assert.equal(dateMatches(exact, clause("<7d"), now), false)
    assert.equal(dateMatches(newer, clause(">7d"), now), true)
    assert.equal(dateMatches(older, clause("<7d"), now), true)
    assert.equal(dateMatches(exact, clause("7d..30d"), now), true)
    assert.equal(dateMatches(older, clause("7d..30d"), now), true)
    assert.equal(dateMatches(newer, clause("7d..30d"), now), false)
  })

  test("calendar dates use the local day, and today and week follow now", () => {
    const now = new Date(2026, 9, 12, 15, 0, 0).getTime()
    const onDay = (day: number) => new Date(2026, 9, day, 12, 0, 0).toISOString()
    const clause = (value: string) => parseDateClause(value)!
    assert.equal(dateMatches(onDay(12), clause("today"), now), true)
    assert.equal(dateMatches(onDay(11), clause("today"), now), false)
    assert.equal(dateMatches(onDay(1), clause(">2026-10-01"), now), false)
    assert.equal(dateMatches(onDay(2), clause(">2026-10-01"), now), true)
    assert.equal(dateMatches(onDay(1), clause(">=2026-10-01"), now), true)
    assert.equal(dateMatches(onDay(1), clause("<=2026-10-01"), now), true)
    assert.equal(dateMatches(onDay(2), clause("<=2026-10-01"), now), false)
    assert.equal(dateMatches(onDay(1), clause("2026-10-01..2026-10-03"), now), true)
    assert.equal(dateMatches(onDay(3), clause("2026-10-03..2026-10-01"), now), true)
    assert.equal(dateMatches(onDay(4), clause("2026-10-01..2026-10-03"), now), false)
    const weekStart = startOfWeek(new Date(now), { weekStartsOn: 1 })
    assert.equal(dateMatches(weekStart.toISOString(), clause("week"), now), true)
    assert.equal(dateMatches(addDays(weekStart, 6).toISOString(), clause("week"), now), true)
    assert.equal(dateMatches(addDays(weekStart, -1).toISOString(), clause("week"), now), false)
    assert.equal(dateMatches(startOfDay(new Date(now)).toISOString(), clause("today"), now), true)
  })

  test("qualifiers round-trip through the query string", () => {
    const q = "type:review date:>7d updated:2026-01-01..2026-06-01 has:comments agents"
    assert.equal(libraryParamsFromSearch(librarySearch({ q })).q, q)
    assert.equal(libraryParamsFromSearch("?project=var&type=review&q=agents").q, "type:review project:var agents")
  })
})
