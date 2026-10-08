/**
 * Remote mutation and shutdown budget.
 * A person posting comments stays well under 60 requests per minute.
 * The key table is capped so distinct client addresses cannot grow it forever.
 */
export const REMOTE_API_RATE_LIMIT = {
  maxRequests: 60,
  windowMs: 60_000,
  maxTrackedKeys: 1_024,
} as const

export type RateLimitDecision =
  | { readonly _tag: "allow" }
  | { readonly _tag: "reject"; readonly retryAfterSeconds: number }

export interface FixedWindowRateLimiterOptions {
  readonly maxRequests: number
  readonly windowMs: number
  readonly maxTrackedKeys: number
}

export interface FixedWindowRateLimiter {
  consume(key: string, nowMs: number): RateLimitDecision
  trackedKeyCount(): number
}

interface Bucket {
  windowStartedAtMs: number
  count: number
}

/**
 * Fixed-window counter keyed by client address.
 *
 * Expired buckets are removed on the next consume. A new key is refused
 * once `maxTrackedKeys` live buckets remain, instead of evicting someone
 * who still has budget. Memory stays capped and rotating addresses cannot
 * allocate a fresh bucket for every request.
 */
export function createFixedWindowRateLimiter(options: FixedWindowRateLimiterOptions): FixedWindowRateLimiter {
  assertPositiveInteger("maxRequests", options.maxRequests)
  assertPositiveInteger("windowMs", options.windowMs)
  assertPositiveInteger("maxTrackedKeys", options.maxTrackedKeys)

  const buckets = new Map<string, Bucket>()

  function pruneExpired(nowMs: number): void {
    for (const [key, bucket] of buckets) {
      if (isExpired(bucket, nowMs, options.windowMs)) buckets.delete(key)
    }
  }

  return {
    consume(key: string, nowMs: number): RateLimitDecision {
      pruneExpired(nowMs)
      const current = buckets.get(key)
      if (current) {
        if (current.count >= options.maxRequests) {
          return {
            _tag: "reject",
            retryAfterSeconds: retryAfterSeconds(current.windowStartedAtMs, nowMs, options.windowMs),
          }
        }
        current.count += 1
        return { _tag: "allow" }
      }

      if (buckets.size >= options.maxTrackedKeys) {
        return {
          _tag: "reject",
          retryAfterSeconds: earliestRetryAfterSeconds(buckets, nowMs, options.windowMs),
        }
      }

      buckets.set(key, { windowStartedAtMs: nowMs, count: 1 })
      return { _tag: "allow" }
    },
    trackedKeyCount(): number {
      return buckets.size
    },
  }
}

function isExpired(bucket: Bucket, nowMs: number, windowMs: number): boolean {
  return nowMs - bucket.windowStartedAtMs >= windowMs
}

function retryAfterSeconds(windowStartedAtMs: number, nowMs: number, windowMs: number): number {
  const remainingMs = windowStartedAtMs + windowMs - nowMs
  if (remainingMs <= 0) return 1
  return Math.max(1, Math.ceil(remainingMs / 1000))
}

function earliestRetryAfterSeconds(buckets: ReadonlyMap<string, Bucket>, nowMs: number, windowMs: number): number {
  let soonestMs = Number.POSITIVE_INFINITY
  for (const bucket of buckets.values()) {
    const remainingMs = bucket.windowStartedAtMs + windowMs - nowMs
    if (remainingMs < soonestMs) soonestMs = remainingMs
  }
  if (!Number.isFinite(soonestMs) || soonestMs <= 0) return 1
  return Math.max(1, Math.ceil(soonestMs / 1000))
}

function assertPositiveInteger(name: string, value: number): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer`)
  }
}
