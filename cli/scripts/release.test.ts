import { describe, expect, test } from "bun:test"
import { canSmokeTestTarget, type Target } from "./release"

const target = (os: string, arch: string): Target => ({
  id: `${os}-${arch}`,
  bunTarget: "unused",
  os,
  arch,
})

describe("canSmokeTestTarget", () => {
  test("matches both operating system and architecture", () => {
    expect(canSmokeTestTarget(target("macos", "x86_64"), "darwin", "x64")).toBe(true)
    expect(canSmokeTestTarget(target("macos", "aarch64"), "darwin", "x64")).toBe(false)
    expect(canSmokeTestTarget(target("linux", "aarch64"), "linux", "arm64")).toBe(true)
    expect(canSmokeTestTarget(target("linux", "x86_64"), "linux", "arm64")).toBe(false)
  })

  test("rejects a different operating system", () => {
    expect(canSmokeTestTarget(target("linux", "x86_64"), "darwin", "x64")).toBe(false)
  })
})
