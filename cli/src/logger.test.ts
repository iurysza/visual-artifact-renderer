import { describe, expect, test } from "bun:test"

import { formatHumanResult, formatPlainRecords } from "./logger.ts"

describe("plain result records", () => {
  test("create, open, serve, and validation records", () => {
    expect(formatPlainRecords({ command: "create", url: "https://example.test/a" })).toEqual([
      "https://example.test/a",
    ])
    expect(formatPlainRecords({
      command: "create",
      dryRun: true,
      slug: "demo",
      totalNodes: 3,
      datasetCount: 1,
    })).toEqual(["VALID\tdemo\t3\t1"])
    expect(formatPlainRecords({ command: "open", url: "https://example.test/open" })).toEqual([
      "https://example.test/open",
    ])
    expect(formatPlainRecords({ command: "serve", url: "http://127.0.0.1:9998/artifacts" })).toEqual([
      "http://127.0.0.1:9998/artifacts",
    ])
    expect(formatPlainRecords({ command: "validate", slug: "demo", totalNodes: 3, datasetCount: 1 })).toEqual([
      "VALID\tdemo\t3\t1",
    ])
  })

  test("list records sanitize embedded separators", () => {
    expect(formatPlainRecords({
      command: "list",
      projects: [{ name: "demo", artifactCount: 2 }],
      artifacts: [{
        project: "demo",
        slug: "one",
        title: "line\tone\r\nline two",
        modifiedAt: "2026-07-10T00:00:00.000Z",
      }],
    })).toEqual([
      "PROJECT\tdemo\t2\t--",
      "ARTIFACT\tdemo\tone\tline one line two\t2026-07-10T00:00:00.000Z",
    ])
  })

  test("doctor and lifecycle records use stable placeholders", () => {
    expect(formatPlainRecords({
      command: "doctor",
      checks: [{ check: "contract", ok: true }, { check: "server", ok: false, message: "down" }],
    })).toEqual(["PASS\tcontract\t--", "FAIL\tserver\tdown"])
    expect(formatPlainRecords({
      command: "serve status",
      running: false,
      tracked: false,
      url: "http://127.0.0.1:9998/artifacts",
    })).toEqual(["STOPPED\thttp://127.0.0.1:9998/artifacts\tUNTRACKED\t--"])
    expect(formatPlainRecords({
      command: "serve stop",
      stopped: false,
      method: "refused",
      url: "http://127.0.0.1:9998/artifacts",
    })).toEqual(["REFUSED\thttp://127.0.0.1:9998/artifacts\trefused\t--"])
  })

  test("contract, setup, and bootstrap records", () => {
    expect(formatPlainRecords({ command: "contract", version: "1.0.0", nodeTypes: ["text", "card"] })).toEqual([
      "CONTRACT\t1.0.0",
      "NODE\ttext",
      "NODE\tcard",
    ])
    expect(formatPlainRecords({ command: "contract", version: "1.0.0", node: { type: "text" } })).toEqual([
      "CONTRACT\t1.0.0",
      "NODE\ttext",
    ])
    expect(formatPlainRecords({
      command: "setup cloudflare",
      profileName: "default",
      baseUrl: "https://worker.example",
    })).toEqual(["PROFILE\tdefault\thttps://worker.example"])
    expect(formatPlainRecords({
      command: "migrate-store",
      migrated: 3,
      deduplicated: 1,
      target: "/tmp/artifacts",
    })).toEqual(["MIGRATED\t3\t1\t/tmp/artifacts"])
    expect(formatPlainRecords({
      command: "bootstrap",
      dryRun: true,
      checks: [{ prerequisite: "bun", ok: true }],
    })).toEqual(["PASS\tbun\t--"])
    expect(formatPlainRecords({ command: "bootstrap", binaryPath: "/tmp/visual-artifact" })).toEqual([
      "INSTALLED\t/tmp/visual-artifact",
    ])
  })
})

describe("human results", () => {
  test("never inspect objects implicitly", () => {
    const outputs = [
      formatHumanResult({ command: "validate", slug: "demo", totalNodes: 3 }),
      formatHumanResult({ command: "list", projects: [{ name: "demo", artifactCount: 1 }] }),
      formatHumanResult({ command: "doctor", ok: true, checks: [{ check: "contract", ok: true }] }),
      formatHumanResult({ command: "serve status", running: false, tracked: false, url: "http://localhost" }),
      formatHumanResult({ command: "migrate-store", migrated: 3, deduplicated: 1, target: "/tmp/artifacts" }),
    ]
    for (const output of outputs) {
      expect(output).not.toContain("[object Object]")
      expect(output.length).toBeGreaterThan(0)
    }
  })
})
