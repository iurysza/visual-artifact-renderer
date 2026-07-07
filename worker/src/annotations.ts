export interface AnnotationAuthor {
  name: string
  email: string
}

export const LOCAL_ANONYMOUS_AUTHOR: AnnotationAuthor = {
  name: "Local Author",
  email: "local-author@example.test",
}

export interface AnnotationAnchor {
  nodeId?: string
  nodePath: string
  nodeType: string
  textSnippet?: string
  x?: number
  y?: number
}

export type AnnotationThreadStatus = "open" | "resolved"

export interface AnnotationMessage {
  id: string
  author: AnnotationAuthor
  body: string
  createdAt: string
  updatedAt: string
}

export interface AnnotationThread {
  id: string
  anchor: AnnotationAnchor
  status: AnnotationThreadStatus
  createdAt: string
  updatedAt: string
  messages: AnnotationMessage[]
}

export interface AnnotationDocument {
  version: 1
  project: string
  slug: string
  threads: AnnotationThread[]
}

export type AnnotationMutation =
  | { type: "createThread"; thread: AnnotationThread }
  | { type: "addMessage"; threadId: string; message: AnnotationMessage }
  | { type: "resolveThread"; threadId: string }
  | { type: "reopenThread"; threadId: string }
  | { type: "deleteMessage"; threadId: string; messageId: string }
  | { type: "editMessage"; threadId: string; messageId: string; body: string; updatedAt: string }

export type AnnotationMutations = AnnotationMutation[]

export class AnnotationValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AnnotationValidationError"
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || (typeof value === "string" && value.length > 0)
}

function isStatus(value: unknown): value is AnnotationThreadStatus {
  return value === "open" || value === "resolved"
}

function parseAuthor(input: unknown): AnnotationAuthor {
  if (!isObject(input)) throw new AnnotationValidationError("author must be an object")
  const name = input.name
  const email = input.email
  if (!isString(name)) throw new AnnotationValidationError("author.name is required")
  if (!isString(email)) throw new AnnotationValidationError("author.email is required")
  return { name, email }
}

function parseAnchor(input: unknown): AnnotationAnchor {
  if (!isObject(input)) throw new AnnotationValidationError("anchor must be an object")
  const nodePath = input.nodePath
  const nodeType = input.nodeType
  if (!isString(nodePath)) throw new AnnotationValidationError("anchor.nodePath is required")
  if (!isString(nodeType)) throw new AnnotationValidationError("anchor.nodeType is required")
  return {
    nodePath,
    nodeType,
    nodeId: isOptionalString(input.nodeId) ? input.nodeId : undefined,
    textSnippet: isOptionalString(input.textSnippet) ? input.textSnippet : undefined,
    x: typeof input.x === "number" ? input.x : undefined,
    y: typeof input.y === "number" ? input.y : undefined,
  }
}

function parseMessage(input: unknown): AnnotationMessage {
  if (!isObject(input)) throw new AnnotationValidationError("message must be an object")
  const id = input.id
  const body = input.body
  const createdAt = input.createdAt
  const updatedAt = input.updatedAt
  if (!isString(id)) throw new AnnotationValidationError("message.id is required")
  if (!isString(body)) throw new AnnotationValidationError("message.body is required")
  if (!isString(createdAt)) throw new AnnotationValidationError("message.createdAt is required")
  if (!isString(updatedAt)) throw new AnnotationValidationError("message.updatedAt is required")
  return {
    id,
    author: parseAuthor(input.author),
    body,
    createdAt,
    updatedAt,
  }
}

function parseThread(input: unknown): AnnotationThread {
  if (!isObject(input)) throw new AnnotationValidationError("thread must be an object")
  const id = input.id
  const status = input.status
  const createdAt = input.createdAt
  const updatedAt = input.updatedAt
  if (!isString(id)) throw new AnnotationValidationError("thread.id is required")
  if (!isStatus(status)) throw new AnnotationValidationError("thread.status must be open or resolved")
  if (!isString(createdAt)) throw new AnnotationValidationError("thread.createdAt is required")
  if (!isString(updatedAt)) throw new AnnotationValidationError("thread.updatedAt is required")
  const messages = input.messages
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new AnnotationValidationError("thread.messages must be a non-empty array")
  }
  return {
    id,
    anchor: parseAnchor(input.anchor),
    status,
    createdAt,
    updatedAt,
    messages: messages.map((m, i) => {
      try {
        return parseMessage(m)
      } catch (err) {
        if (err instanceof AnnotationValidationError) {
          throw new AnnotationValidationError(`thread.messages[${i}]: ${err.message}`)
        }
        throw err
      }
    }),
  }
}

function parseMutation(input: unknown, index: number): AnnotationMutation {
  if (!isObject(input)) throw new AnnotationValidationError(`mutations[${index}] must be an object`)
  const type = input.type
  if (!isString(type)) throw new AnnotationValidationError(`mutations[${index}].type is required`)

  switch (type) {
    case "createThread": {
      if (!isObject(input.thread)) throw new AnnotationValidationError(`mutations[${index}].thread is required`)
      try {
        return { type, thread: parseThread(input.thread) }
      } catch (err) {
        if (err instanceof AnnotationValidationError) {
          throw new AnnotationValidationError(`mutations[${index}].thread: ${err.message}`)
        }
        throw err
      }
    }
    case "addMessage": {
      const threadId = input.threadId
      if (!isString(threadId)) throw new AnnotationValidationError(`mutations[${index}].threadId is required`)
      if (!isObject(input.message)) throw new AnnotationValidationError(`mutations[${index}].message is required`)
      try {
        return { type, threadId, message: parseMessage(input.message) }
      } catch (err) {
        if (err instanceof AnnotationValidationError) {
          throw new AnnotationValidationError(`mutations[${index}].message: ${err.message}`)
        }
        throw err
      }
    }
    case "resolveThread":
    case "reopenThread": {
      const threadId = input.threadId
      if (!isString(threadId)) throw new AnnotationValidationError(`mutations[${index}].threadId is required`)
      return { type, threadId }
    }
    case "deleteMessage": {
      const threadId = input.threadId
      const messageId = input.messageId
      if (!isString(threadId)) throw new AnnotationValidationError(`mutations[${index}].threadId is required`)
      if (!isString(messageId)) throw new AnnotationValidationError(`mutations[${index}].messageId is required`)
      return { type, threadId, messageId }
    }
    case "editMessage": {
      const threadId = input.threadId
      const messageId = input.messageId
      const body = input.body
      const updatedAt = input.updatedAt
      if (!isString(threadId)) throw new AnnotationValidationError(`mutations[${index}].threadId is required`)
      if (!isString(messageId)) throw new AnnotationValidationError(`mutations[${index}].messageId is required`)
      if (!isString(body)) throw new AnnotationValidationError(`mutations[${index}].body is required`)
      if (!isString(updatedAt)) throw new AnnotationValidationError(`mutations[${index}].updatedAt is required`)
      return { type, threadId, messageId, body, updatedAt }
    }
    default:
      throw new AnnotationValidationError(`mutations[${index}].type "${type}" is not supported`)
  }
}

export function parseAnnotationMutations(input: unknown): AnnotationMutations {
  if (!Array.isArray(input)) throw new AnnotationValidationError("mutations must be an array")
  return input.map((m, i) => parseMutation(m, i))
}

export function emptyAnnotationDocument(project: string, slug: string): AnnotationDocument {
  return { version: 1, project, slug, threads: [] }
}

export function applyMutations(doc: AnnotationDocument, mutations: AnnotationMutations): AnnotationDocument {
  let threads = [...doc.threads]

  for (const mutation of mutations) {
    switch (mutation.type) {
      case "createThread": {
        if (threads.some((t) => t.id === mutation.thread.id)) {
          throw new AnnotationValidationError(`thread ${mutation.thread.id} already exists`)
        }
        threads = [...threads, mutation.thread]
        break
      }
      case "addMessage": {
        threads = threads.map((thread) => {
          if (thread.id !== mutation.threadId) return thread
          return {
            ...thread,
            updatedAt: mutation.message.createdAt,
            messages: [...thread.messages, mutation.message],
          }
        })
        break
      }
      case "deleteMessage": {
        threads = threads
          .map((thread) => {
            if (thread.id !== mutation.threadId) return thread
            const messages = thread.messages.filter((m) => m.id !== mutation.messageId)
            if (messages.length === 0) return null
            return { ...thread, messages, updatedAt: new Date().toISOString() }
          })
          .filter((thread): thread is AnnotationThread => thread !== null)
        break
      }
      case "editMessage": {
        threads = threads.map((thread) => {
          if (thread.id !== mutation.threadId) return thread
          const messages = thread.messages.map((m) =>
            m.id === mutation.messageId ? { ...m, body: mutation.body, updatedAt: mutation.updatedAt } : m,
          )
          return { ...thread, messages, updatedAt: mutation.updatedAt }
        })
        break
      }
      case "resolveThread": {
        threads = threads.map((thread) =>
          thread.id === mutation.threadId ? { ...thread, status: "resolved" as const } : thread,
        )
        break
      }
      case "reopenThread": {
        threads = threads.map((thread) =>
          thread.id === mutation.threadId ? { ...thread, status: "open" as const } : thread,
        )
        break
      }
      default: {
        const _exhaustive: never = mutation
        throw new AnnotationValidationError(`unsupported mutation type ${_exhaustive}`)
      }
    }
  }

  return { ...doc, threads }
}
