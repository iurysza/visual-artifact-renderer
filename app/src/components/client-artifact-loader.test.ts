import assert from "node:assert/strict"
import test from "node:test"

import { RAW_ARTIFACT_MAX_BYTES } from "@/lib/contract/artifact-schema"
import { readResponseTextBounded } from "./client-artifact-loader"

test("rejects oversized content-length before reading the response", async () => {
  const response = new Response("{}", {
    headers: { "content-length": String(RAW_ARTIFACT_MAX_BYTES + 1) },
  })
  await assert.rejects(readResponseTextBounded(response), /exceeds/)
})

test("rejects an oversized streamed response without content-length", async () => {
  const response = new Response(new Uint8Array(RAW_ARTIFACT_MAX_BYTES + 1))
  await assert.rejects(readResponseTextBounded(response), /exceeds/)
})

test("decodes a bounded streamed response", async () => {
  const response = new Response('{"title":"Olá"}')
  assert.equal(await readResponseTextBounded(response), '{"title":"Olá"}')
})
