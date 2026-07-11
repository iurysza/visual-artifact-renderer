import { describe, expect, test } from "bun:test"
import { mkdtemp, mkdir, readdir, rm, stat, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  parseAnnotationAuthor,
  parseAnnotationAnchor,
  parseAnnotationDocument,
  parseAnnotationMutation,
  parseAnnotationMutations,
  emptyAnnotationDocument,
  LOCAL_ANONYMOUS_AUTHOR,
} from "@agents/visual-artifact-annotations"
import {
  applyMutations,
  ArtifactNotFoundError,
  mutateAnnotationsDocument,
  readAnnotationsDocument,
  resolveLocalAuthor,
  writeAnnotationsDocument,
} from "./annotations.ts"

async function makeTempDir(prefix: string): Promise<string> {
  return mkdtemp(join(tmpdir(), prefix))
}

async function writeArtifact(dir: string, project: string, slug: string): Promise<string> {
  const bundleDir = join(dir, project, slug)
  await mkdir(bundleDir, { recursive: true })
  await writeFile(
    join(bundleDir, "artifact.json"),
    JSON.stringify({ slug, title: slug, nodes: [{ type: "text", props: { text: "x" } }] }),
    "utf8",
  )
  return bundleDir
}

const validAuthor = { name: "Iury Souza", email: "iury@example.com" }
const validAnchor = {
  nodeId: "summary-card",
  nodePath: "nodes.1.children.0",
  nodeType: "stat-card",
  textSnippet: "Executive Summary",
  x: 0.42,
  y: 0.18,
}
const validMessage = {
  id: "msg_123",
  author: validAuthor,
  body: "This wording is confusing.",
  createdAt: "2026-07-03T00:00:00.000Z",
  updatedAt: "2026-07-03T00:00:00.000Z",
}
const validThread = {
  id: "thr_123",
  anchor: validAnchor,
  status: "open" as const,
  createdAt: "2026-07-03T00:00:00.000Z",
  updatedAt: "2026-07-03T00:00:00.000Z",
  messages: [validMessage],
}
const validDocument = {
  version: 1 as const,
  project: "example-project",
  slug: "example-artifact",
  threads: [validThread],
}

describe("parseAnnotationAuthor", () => {
  test("accepts valid author", () => {
    expect(parseAnnotationAuthor(validAuthor)).toEqual(validAuthor)
  })

  test("rejects missing name", () => {
    expect(() => parseAnnotationAuthor({ email: "iury@example.com" })).toThrow(/name/)
  })

  test("rejects invalid email", () => {
    expect(() => parseAnnotationAuthor({ name: "Iury", email: "not-an-email" })).toThrow(/email/)
  })

  test("rejects extra keys", () => {
    expect(() => parseAnnotationAuthor({ ...validAuthor, avatar: "x" })).toThrow(/avatar/)
  })

  test("accepts local fallback author", () => {
    expect(parseAnnotationAuthor(LOCAL_ANONYMOUS_AUTHOR)).toEqual(LOCAL_ANONYMOUS_AUTHOR)
  })
})

describe("parseAnnotationAnchor", () => {
  test("accepts valid anchor", () => {
    expect(parseAnnotationAnchor(validAnchor)).toEqual(validAnchor)
  })

  test("rejects missing nodePath", () => {
    expect(() => parseAnnotationAnchor({ nodeType: "text" })).toThrow(/nodePath/)
  })

  test("rejects coordinate out of range", () => {
    expect(() => parseAnnotationAnchor({ ...validAnchor, x: 1.5 })).toThrow(/x/)
  })
})

describe("parseAnnotationDocument", () => {
  test("accepts valid document", () => {
    expect(parseAnnotationDocument(validDocument)).toEqual(validDocument)
  })

  test("rejects wrong version", () => {
    expect(() => parseAnnotationDocument({ ...validDocument, version: 2 })).toThrow(/version/)
  })

  test("rejects missing project", () => {
    expect(() => parseAnnotationDocument({ ...validDocument, project: undefined })).toThrow(/project/)
  })

  test("rejects thread with empty messages", () => {
    const bad = { ...validDocument, threads: [{ ...validThread, messages: [] }] }
    expect(() => parseAnnotationDocument(bad)).toThrow(/messages/)
  })
})

describe("parseAnnotationMutation", () => {
  test("accepts createThread mutation", () => {
    const mutation = { type: "createThread" as const, thread: validThread }
    expect(parseAnnotationMutation(mutation)).toEqual(mutation)
  })

  test("accepts addMessage mutation", () => {
    const mutation = { type: "addMessage" as const, threadId: "thr_123", message: validMessage }
    expect(parseAnnotationMutation(mutation)).toEqual(mutation)
  })

  test("accepts resolveThread mutation", () => {
    const mutation = { type: "resolveThread" as const, threadId: "thr_123" }
    expect(parseAnnotationMutation(mutation)).toEqual(mutation)
  })

  test("accepts deleteMessage mutation", () => {
    const mutation = { type: "deleteMessage" as const, threadId: "thr_123", messageId: "msg_123" }
    expect(parseAnnotationMutation(mutation)).toEqual(mutation)
  })

  test("accepts editMessage mutation", () => {
    const mutation = {
      type: "editMessage" as const,
      threadId: "thr_123",
      messageId: "msg_123",
      body: "Updated.",
      updatedAt: "2026-07-04T00:00:00.000Z",
    }
    expect(parseAnnotationMutation(mutation)).toEqual(mutation)
  })

  test("rejects unknown mutation type", () => {
    expect(() => parseAnnotationMutation({ type: "deleteThread", threadId: "thr_123" })).toThrow(/type/)
  })

  test("rejects createThread with invalid thread", () => {
    expect(() =>
      parseAnnotationMutation({ type: "createThread" as const, thread: { ...validThread, id: "" } }),
    ).toThrow(/id/)
  })
})

describe("parseAnnotationMutations invalid fixtures", () => {
  test("rejects invalid timestamp", () => {
    const badMessage = { ...validMessage, createdAt: "not-a-timestamp" }
    const badThread = { ...validThread, messages: [badMessage] }
    expect(() => parseAnnotationMutations([{ type: "createThread", thread: badThread }])).toThrow(/createdAt/)
  })

  test("rejects invalid thread status", () => {
    const badThread = { ...validThread, status: "closed" }
    expect(() => parseAnnotationMutations([{ type: "createThread", thread: badThread }])).toThrow(/status/)
  })

  test("rejects malformed author in message", () => {
    const badMessage = { ...validMessage, author: { name: "X" } }
    const badThread = { ...validThread, messages: [badMessage] }
    expect(() => parseAnnotationMutations([{ type: "createThread", thread: badThread }])).toThrow(/email/)
  })
})

describe("applyMutations", () => {
  test("creates thread", () => {
    const doc = emptyAnnotationDocument("example-project", "example-artifact")
    const updated = applyMutations(doc, [{ type: "createThread", thread: validThread }])
    expect(updated.threads).toHaveLength(1)
    expect(updated.threads[0].id).toBe("thr_123")
  })

  test("adds message to existing thread", () => {
    const doc = emptyAnnotationDocument("example-project", "example-artifact")
    const withThread = applyMutations(doc, [{ type: "createThread", thread: validThread }])
    const reply = { ...validMessage, id: "msg_456", body: "Agreed." }
    const updated = applyMutations(withThread, [{ type: "addMessage", threadId: "thr_123", message: reply }])
    expect(updated.threads[0].messages).toHaveLength(2)
  })

  test("resolves and reopens thread", () => {
    const doc = { ...validDocument }
    const resolved = applyMutations(doc, [{ type: "resolveThread", threadId: "thr_123" }])
    expect(resolved.threads[0].status).toBe("resolved")
    const reopened = applyMutations(resolved, [{ type: "reopenThread", threadId: "thr_123" }])
    expect(reopened.threads[0].status).toBe("open")
  })

  test("edits message body and updatedAt", () => {
    const doc = { ...validDocument }
    const updated = applyMutations(doc, [
      {
        type: "editMessage",
        threadId: "thr_123",
        messageId: "msg_123",
        body: "Updated wording.",
        updatedAt: "2026-07-04T00:00:00.000Z",
      },
    ])
    expect(updated.threads[0].messages[0].body).toBe("Updated wording.")
    expect(updated.threads[0].messages[0].updatedAt).toBe("2026-07-04T00:00:00.000Z")
  })

  test("deletes message and removes empty thread", () => {
    const doc = { ...validDocument }
    const updated = applyMutations(doc, [
      { type: "deleteMessage", threadId: "thr_123", messageId: "msg_123" },
    ])
    expect(updated.threads).toHaveLength(0)
  })

  test("deletes message and keeps thread with remaining messages", () => {
    const doc = { ...validDocument }
    const withReply = applyMutations(doc, [
      {
        type: "addMessage",
        threadId: "thr_123",
        message: { ...validMessage, id: "msg_456", body: "Agreed." },
      },
    ])
    const updated = applyMutations(withReply, [
      { type: "deleteMessage", threadId: "thr_123", messageId: "msg_123" },
    ])
    expect(updated.threads).toHaveLength(1)
    expect(updated.threads[0].messages).toHaveLength(1)
    expect(updated.threads[0].messages[0].id).toBe("msg_456")
  })

  test("fails when thread not found", () => {
    const doc = emptyAnnotationDocument("example-project", "example-artifact")
    expect(() => applyMutations(doc, [{ type: "resolveThread", threadId: "missing" }])).toThrow(/not found/)
  })
})

describe("readAnnotationsDocument", () => {
  test("returns empty document when annotations are missing for an existing artifact", async () => {
    const dir = await makeTempDir("visualizer-annotations-")
    try {
      await writeArtifact(dir, "project", "slug")
      const doc = await readAnnotationsDocument(dir, { project: "project", slug: "slug" })
      expect(doc).toEqual(emptyAnnotationDocument("project", "slug"))
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test("rejects a missing artifact without creating annotation state", async () => {
    const dir = await makeTempDir("visualizer-annotations-")
    try {
      await expect(
        readAnnotationsDocument(dir, { project: "project", slug: "missing" }),
      ).rejects.toBeInstanceOf(ArtifactNotFoundError)
      expect(await readdir(dir)).toEqual([])
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test("parses existing document", async () => {
    const dir = await makeTempDir("visualizer-annotations-")
    try {
      const projectDir = await writeArtifact(dir, "example-project", "example-artifact")
      await writeFile(join(projectDir, "annotations.json"), JSON.stringify(validDocument), "utf8")
      const doc = await readAnnotationsDocument(dir, { project: "example-project", slug: "example-artifact" })
      expect(doc).toEqual(validDocument)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})

describe("round-trip write/read", () => {
  test("writes mutation then reads back the same document", async () => {
    const dir = await makeTempDir("visualizer-annotations-")
    try {
      const route = { project: "example-project", slug: "example-artifact" }
      await writeArtifact(dir, route.project, route.slug)
      const doc = await readAnnotationsDocument(dir, route)
      const updated = applyMutations(doc, [{ type: "createThread", thread: validThread }])
      await writeAnnotationsDocument(dir, route, updated)
      const read = await readAnnotationsDocument(dir, route)
      expect(read).toEqual(updated)
      expect(read.threads[0].messages[0].body).toBe("This wording is confusing.")
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})

describe("serialized atomic writes", () => {
  test("preserves 20 concurrent unique mutations", async () => {
    const dir = await makeTempDir("visualizer-annotations-concurrent-")
    const route = { project: "example-project", slug: "example-artifact" }
    try {
      await writeArtifact(dir, route.project, route.slug)
      await Promise.all(
        Array.from({ length: 20 }, (_, index) => {
          const suffix = String(index)
          const thread = {
            ...validThread,
            id: `thr_${suffix}`,
            messages: [{ ...validMessage, id: `msg_${suffix}`, body: `message ${suffix}` }],
          }
          return mutateAnnotationsDocument(dir, route, [{ type: "createThread", thread }])
        }),
      )
      const document = await readAnnotationsDocument(dir, route)
      expect(document.threads).toHaveLength(20)
      expect(new Set(document.threads.map((thread) => thread.id)).size).toBe(20)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test("atomically replaces with mode 0600 and leaves no temp files", async () => {
    const dir = await makeTempDir("visualizer-annotations-atomic-")
    const route = { project: "example-project", slug: "example-artifact" }
    try {
      const bundleDir = await writeArtifact(dir, route.project, route.slug)
      await writeAnnotationsDocument(dir, route, validDocument)
      const fileStat = await stat(join(bundleDir, "annotations.json"))
      expect(fileStat.mode & 0o777).toBe(0o600)
      expect((await readdir(bundleDir)).filter((name) => name.endsWith(".tmp"))).toEqual([])
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  test("rename failure preserves the original and removes the temp file", async () => {
    const dir = await makeTempDir("visualizer-annotations-failure-")
    const route = { project: "example-project", slug: "example-artifact" }
    try {
      const bundleDir = await writeArtifact(dir, route.project, route.slug)
      await writeAnnotationsDocument(dir, route, validDocument)
      const original = await readAnnotationsDocument(dir, route)
      const changed = { ...validDocument, threads: [] }

      await expect(
        writeAnnotationsDocument(dir, route, changed, {
          rename: async () => {
            throw new Error("injected rename failure")
          },
        }),
      ).rejects.toThrow("injected rename failure")

      expect(await readAnnotationsDocument(dir, route)).toEqual(original)
      expect((await readdir(bundleDir)).filter((name) => name.endsWith(".tmp"))).toEqual([])
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})

describe("resolveLocalAuthor", () => {
  test("returns an author with name and email", async () => {
    const author = await resolveLocalAuthor()
    expect(author.name).toBeTruthy()
    expect(author.email).toBeTruthy()
  })
})
