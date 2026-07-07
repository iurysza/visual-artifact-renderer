import { describe, expect, test } from "bun:test"
import {
  applyMutations,
  emptyAnnotationDocument,
  LOCAL_ANONYMOUS_AUTHOR,
  parseAnnotationMutations,
  AnnotationValidationError,
} from "../src/annotations.ts"

const author = LOCAL_ANONYMOUS_AUTHOR

function makeThread(id: string, body: string): ReturnType<typeof applyMutations>["threads"][number] {
  return {
    id,
    anchor: { nodePath: "nodes.0", nodeType: "text" },
    status: "open",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    messages: [
      {
        id: `msg-${id}`,
        author,
        body,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
      },
    ],
  }
}

describe("parseAnnotationMutations", () => {
  test("accepts a valid createThread mutation", () => {
    const mutations = [
      {
        type: "createThread",
        thread: makeThread("t1", "hello"),
      },
    ]
    expect(parseAnnotationMutations(mutations)).toHaveLength(1)
  })

  test("rejects unsupported mutation type", () => {
    expect(() => parseAnnotationMutations([{ type: "unknown" }])).toThrow(AnnotationValidationError)
  })

  test("rejects non-array input", () => {
    expect(() => parseAnnotationMutations({})).toThrow(AnnotationValidationError)
  })
})

describe("applyMutations", () => {
  test("creates a thread", () => {
    const doc = emptyAnnotationDocument("demo", "hello")
    const updated = applyMutations(doc, [{ type: "createThread", thread: makeThread("t1", "hello") }])
    expect(updated.threads).toHaveLength(1)
    expect(updated.threads[0].messages[0].body).toBe("hello")
  })

  test("rejects duplicate thread id", () => {
    const thread = makeThread("t1", "hello")
    const doc = applyMutations(emptyAnnotationDocument("demo", "hello"), [
      { type: "createThread", thread },
    ])
    expect(() => applyMutations(doc, [{ type: "createThread", thread }])).toThrow(
      AnnotationValidationError,
    )
  })

  test("adds a message to a thread", () => {
    const doc = applyMutations(emptyAnnotationDocument("demo", "hello"), [
      { type: "createThread", thread: makeThread("t1", "hello") },
    ])
    const reply = {
      id: "msg-reply",
      author,
      body: "reply",
      createdAt: "2026-01-02T00:00:00Z",
      updatedAt: "2026-01-02T00:00:00Z",
    }
    const updated = applyMutations(doc, [{ type: "addMessage", threadId: "t1", message: reply }])
    expect(updated.threads[0].messages).toHaveLength(2)
    expect(updated.threads[0].updatedAt).toBe("2026-01-02T00:00:00Z")
  })

  test("edits a message", () => {
    const doc = applyMutations(emptyAnnotationDocument("demo", "hello"), [
      { type: "createThread", thread: makeThread("t1", "hello") },
    ])
    const updated = applyMutations(doc, [
      { type: "editMessage", threadId: "t1", messageId: "msg-t1", body: "edited", updatedAt: "2026-01-03T00:00:00Z" },
    ])
    expect(updated.threads[0].messages[0].body).toBe("edited")
    expect(updated.threads[0].messages[0].updatedAt).toBe("2026-01-03T00:00:00Z")
    expect(updated.threads[0].updatedAt).toBe("2026-01-03T00:00:00Z")
  })

  test("deletes a message and removes empty thread", () => {
    const doc = applyMutations(emptyAnnotationDocument("demo", "hello"), [
      { type: "createThread", thread: makeThread("t1", "hello") },
    ])
    const updated = applyMutations(doc, [
      { type: "deleteMessage", threadId: "t1", messageId: "msg-t1" },
    ])
    expect(updated.threads).toHaveLength(0)
  })

  test("resolves and reopens a thread", () => {
    const doc = applyMutations(emptyAnnotationDocument("demo", "hello"), [
      { type: "createThread", thread: makeThread("t1", "hello") },
    ])
    const resolved = applyMutations(doc, [{ type: "resolveThread", threadId: "t1" }])
    expect(resolved.threads[0].status).toBe("resolved")
    const reopened = applyMutations(resolved, [{ type: "reopenThread", threadId: "t1" }])
    expect(reopened.threads[0].status).toBe("open")
  })
})
