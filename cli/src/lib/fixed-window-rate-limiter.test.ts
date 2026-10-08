import { describe, expect, test } from "bun:test"
import { createFixedWindowRateLimiter } from "./fixed-window-rate-limiter.ts"

describe("fixed-window rate limiter", () => {
  test("allows requests under the limit and rejects the next one", () => {
    const limiter = createFixedWindowRateLimiter({ maxRequests: 2, windowMs: 10_000, maxTrackedKeys: 8 })

    expect(limiter.consume("203.0.113.4", 0)).toEqual({ _tag: "allow" })
    expect(limiter.consume("203.0.113.4", 100)).toEqual({ _tag: "allow" })
    expect(limiter.consume("203.0.113.4", 200)).toEqual({ _tag: "reject", retryAfterSeconds: 10 })
    expect(limiter.consume("203.0.113.8", 200)).toEqual({ _tag: "allow" })
    expect(limiter.trackedKeyCount()).toBe(2)
  })

  test("resets a key after its window expires without extending the lockout", () => {
    const limiter = createFixedWindowRateLimiter({ maxRequests: 1, windowMs: 10_000, maxTrackedKeys: 8 })

    expect(limiter.consume("203.0.113.4", 0)).toEqual({ _tag: "allow" })
    expect(limiter.consume("203.0.113.4", 1_000)).toEqual({ _tag: "reject", retryAfterSeconds: 9 })
    expect(limiter.consume("203.0.113.4", 9_999)).toEqual({ _tag: "reject", retryAfterSeconds: 1 })
    expect(limiter.consume("203.0.113.4", 10_000)).toEqual({ _tag: "allow" })
    expect(limiter.consume("203.0.113.4", 10_000)).toEqual({ _tag: "reject", retryAfterSeconds: 10 })
  })

  test("prunes expired keys and refuses to grow past the key cap", () => {
    const limiter = createFixedWindowRateLimiter({ maxRequests: 5, windowMs: 1_000, maxTrackedKeys: 2 })

    expect(limiter.consume("a", 0)._tag).toBe("allow")
    expect(limiter.consume("b", 100)._tag).toBe("allow")
    expect(limiter.trackedKeyCount()).toBe(2)

    expect(limiter.consume("c", 200)).toEqual({ _tag: "reject", retryAfterSeconds: 1 })
    expect(limiter.trackedKeyCount()).toBe(2)
    expect(limiter.consume("a", 200)._tag).toBe("allow")
    expect(limiter.trackedKeyCount()).toBe(2)

    expect(limiter.consume("c", 1_000)).toEqual({ _tag: "allow" })
    expect(limiter.trackedKeyCount()).toBe(2)
    expect(limiter.consume("d", 1_000)._tag).toBe("reject")
    expect(limiter.trackedKeyCount()).toBe(2)

    expect(limiter.consume("e", 2_000)).toEqual({ _tag: "allow" })
    expect(limiter.trackedKeyCount()).toBe(1)
  })
})
