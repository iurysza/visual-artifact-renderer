/**
 * Largest annotation mutation body the local server will parse.
 * Comment batches are small; 256 KiB is enough for a long thread and
 * still bounds memory before JSON.parse.
 */
export const ANNOTATION_MUTATION_MAX_BYTES = 256 * 1024

export type AnnotationBodyRead =
  | { readonly _tag: "json"; readonly value: unknown }
  | { readonly _tag: "too-large" }
  | { readonly _tag: "invalid-json" }
  | { readonly _tag: "invalid-content-length" }

type DeclaredLength =
  | { readonly _tag: "absent" }
  | { readonly _tag: "within-limit" }
  | { readonly _tag: "too-large" }
  | { readonly _tag: "invalid" }

/**
 * Read a mutation body without accepting more than `maxBytes`.
 *
 * A Content-Length above the cap is rejected before the stream is read.
 * A missing or smaller Content-Length is still counted while streaming, so a
 * short declared length cannot hide a larger chunked body.
 */
export async function readAnnotationMutationBody(
  request: Request,
  maxBytes: number = ANNOTATION_MUTATION_MAX_BYTES,
): Promise<AnnotationBodyRead> {
  const declared = declaredContentLength(request.headers.get("content-length"), maxBytes)
  if (declared._tag === "invalid") {
    await cancelBody(request)
    return { _tag: "invalid-content-length" }
  }
  if (declared._tag === "too-large") {
    await cancelBody(request)
    return { _tag: "too-large" }
  }

  let bytes: Uint8Array
  try {
    const read = await readBodyBounded(request.body, maxBytes)
    if (read._tag === "too-large") return { _tag: "too-large" }
    bytes = read.bytes
  } catch (error) {
    if (isTransportBodyTooLarge(error)) return { _tag: "too-large" }
    throw error
  }

  let text: string
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes)
  } catch {
    return { _tag: "invalid-json" }
  }

  try {
    return { _tag: "json", value: JSON.parse(text) as unknown }
  } catch {
    return { _tag: "invalid-json" }
  }
}

function declaredContentLength(header: string | null, maxBytes: number): DeclaredLength {
  if (header === null) return { _tag: "absent" }
  const value = header.trim()
  if (!/^\d+$/.test(value)) return { _tag: "invalid" }
  if (BigInt(value) > BigInt(maxBytes)) return { _tag: "too-large" }
  return { _tag: "within-limit" }
}

async function readBodyBounded(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
): Promise<{ readonly _tag: "bytes"; readonly bytes: Uint8Array } | { readonly _tag: "too-large" }> {
  if (!body) return { _tag: "bytes", bytes: new Uint8Array() }

  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value || value.byteLength === 0) continue
      total += value.byteLength
      if (total > maxBytes) {
        await reader.cancel().catch(() => {})
        return { _tag: "too-large" }
      }
      chunks.push(value)
    }
  } finally {
    // cancel() already releases the reader; releaseLock throws in that case.
    try {
      reader.releaseLock()
    } catch {
      // The reader was already released.
    }
  }

  return { _tag: "bytes", bytes: concatChunks(chunks, total) }
}

function concatChunks(chunks: readonly Uint8Array[], total: number): Uint8Array {
  const merged = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }
  return merged
}

function isTransportBodyTooLarge(error: unknown): boolean {
  return error instanceof Error && error.message.includes("maxRequestBodySize")
}

async function cancelBody(request: Request): Promise<void> {
  await request.body?.cancel().catch(() => {})
}
