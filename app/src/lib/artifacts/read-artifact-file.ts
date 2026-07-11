import { constants } from "node:fs"
import { open } from "node:fs/promises"

import {
  ArtifactSizeError,
  ArtifactValidationError,
  RAW_ARTIFACT_MAX_BYTES,
} from "@/lib/contract/artifact-schema"

export async function readArtifactFileBounded(
  filePath: string,
  maxBytes: number = RAW_ARTIFACT_MAX_BYTES,
): Promise<string> {
  const handle = await open(filePath, constants.O_RDONLY | constants.O_NONBLOCK)
  try {
    const stats = await handle.stat()
    if (!stats.isFile()) {
      throw new ArtifactValidationError(`${filePath} is not a regular file`)
    }

    const buffer = Buffer.alloc(maxBytes + 1)
    let totalBytes = 0
    while (totalBytes < buffer.length) {
      const { bytesRead } = await handle.read(
        buffer,
        totalBytes,
        buffer.length - totalBytes,
        totalBytes,
      )
      if (bytesRead === 0) break
      totalBytes += bytesRead
    }

    if (totalBytes > maxBytes) {
      throw new ArtifactSizeError(`Artifact JSON is larger than ${maxBytes} bytes`)
    }
    return buffer.subarray(0, totalBytes).toString("utf8")
  } finally {
    await handle.close()
  }
}
