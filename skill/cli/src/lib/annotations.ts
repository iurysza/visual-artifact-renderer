import { readFile, writeFile, mkdir } from "node:fs/promises"
import { spawn } from "node:child_process"
import { dirname } from "node:path"
import {
  emptyAnnotationDocument,
  parseAnnotationDocument,
  parseAnnotationMutations,
  type AnnotationAuthor,
  type AnnotationDocument,
  type AnnotationMutation,
  type AnnotationMutations,
  LOCAL_ANONYMOUS_AUTHOR,
  type AnnotationThread,
} from "@agents/visual-artifact-annotations"
import { annotationsJsonPath, isInsideArtifactsDir, parseBundleRoute, type BundleRoute } from "./paths.ts"

export type { AnnotationAuthor, AnnotationDocument, AnnotationMutation, AnnotationMutations, AnnotationThread }

export async function resolveLocalAuthor(): Promise<AnnotationAuthor> {
  const [name, email] = await Promise.all([
    getGitConfig("user.name"),
    getGitConfig("user.email"),
  ])

  if (!name || !email) {
    return LOCAL_ANONYMOUS_AUTHOR
  }

  return {
    name: name.trim(),
    email: email.trim(),
  }
}

function getGitConfig(key: string): Promise<string | null> {
  return new Promise((resolve) => {
    const child = spawn("git", ["config", key], {
      stdio: ["ignore", "pipe", "ignore"],
      shell: false,
    })

    let output = ""
    child.stdout?.on("data", (data: Buffer) => {
      output += data.toString("utf8")
    })

    child.on("close", (code) => {
      if (code !== 0) {
        resolve(null)
      } else {
        resolve(output.trim())
      }
    })

    child.on("error", () => resolve(null))
  })
}

export function parseBundleRouteFromParams(params: { project: unknown; slug: unknown }): BundleRoute | null {
  return parseBundleRoute(params.project, params.slug)
}

export async function readAnnotationsDocument(
  artifactsDir: string,
  route: BundleRoute,
): Promise<AnnotationDocument> {
  const filePath = annotationsJsonPath(artifactsDir, route.project, route.slug)
  if (!isInsideArtifactsDir(filePath, artifactsDir)) {
    throw new Error("Path traversal detected")
  }

  try {
    const raw = await readFile(filePath, "utf8")
    const parsed = JSON.parse(raw)
    return parseAnnotationDocument(parsed)
  } catch (error) {
    if (isMissingFileError(error)) {
      return emptyAnnotationDocument(route.project, route.slug)
    }
    throw error
  }
}

export async function writeAnnotationsDocument(
  artifactsDir: string,
  route: BundleRoute,
  doc: AnnotationDocument,
): Promise<void> {
  const filePath = annotationsJsonPath(artifactsDir, route.project, route.slug)
  if (!isInsideArtifactsDir(filePath, artifactsDir)) {
    throw new Error("Path traversal detected")
  }
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, `${JSON.stringify(doc, null, 2)}\n`, "utf8")
}

export function applyMutations(
  doc: AnnotationDocument,
  mutations: AnnotationMutations,
): AnnotationDocument {
  let threads = [...doc.threads]

  for (const mutation of mutations) {
    threads = applyMutation(threads, mutation)
  }

  return {
    ...doc,
    threads,
  }
}

function applyMutation(threads: AnnotationThread[], mutation: AnnotationMutation): AnnotationThread[] {
  switch (mutation.type) {
    case "createThread": {
      if (threads.some((t) => t.id === mutation.thread.id)) {
        throw new Error(`Thread ${mutation.thread.id} already exists`)
      }
      return [...threads, mutation.thread]
    }
    case "addMessage": {
      const index = threads.findIndex((t) => t.id === mutation.threadId)
      if (index === -1) {
        throw new Error(`Thread ${mutation.threadId} not found`)
      }
      const updated = [...threads]
      const thread = updated[index]
      if (thread.messages.some((m) => m.id === mutation.message.id)) {
        throw new Error(`Message ${mutation.message.id} already exists in thread ${thread.id}`)
      }
      updated[index] = {
        ...thread,
        messages: [...thread.messages, mutation.message],
        updatedAt: mutation.message.createdAt,
      }
      return updated
    }
    case "resolveThread": {
      const index = threads.findIndex((t) => t.id === mutation.threadId)
      if (index === -1) {
        throw new Error(`Thread ${mutation.threadId} not found`)
      }
      const updated = [...threads]
      updated[index] = { ...updated[index], status: "resolved" }
      return updated
    }
    case "reopenThread": {
      const index = threads.findIndex((t) => t.id === mutation.threadId)
      if (index === -1) {
        throw new Error(`Thread ${mutation.threadId} not found`)
      }
      const updated = [...threads]
      updated[index] = { ...updated[index], status: "open" }
      return updated
    }
  }
}

export function parseAnnotationMutationsPayload(input: unknown): AnnotationMutations {
  if (Array.isArray(input)) {
    return parseAnnotationMutations(input)
  }
  const mutation = parseAnnotationMutations([input])
  return mutation
}

function isMissingFileError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT",
  )
}
