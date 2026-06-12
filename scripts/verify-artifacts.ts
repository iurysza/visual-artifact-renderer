import { promises as fs } from "fs"
import os from "os"
import path from "path"

import { artifactManifest } from "../src/lib/artifact-manifest"
import { ARTIFACT_NODE_TYPES, VisualArtifactSpecSchema } from "../src/lib/artifact-schema"

async function findArtifactFiles(dir: string): Promise<string[]> {
  const files: string[] = []
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        const subFiles = await findArtifactFiles(fullPath)
        files.push(...subFiles)
      } else if (entry.isFile() && entry.name.endsWith(".json")) {
        files.push(fullPath)
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
  }
  return files
}

async function main() {
  const artifactsDir = path.join(os.homedir(), ".pi", "artifacts")
  const files = await findArtifactFiles(artifactsDir)

  for (const filePath of files) {
    const raw = await fs.readFile(filePath, "utf8")
    const parsed = VisualArtifactSpecSchema.parse(JSON.parse(raw))
    const fileName = path.basename(filePath)

    if (`${parsed.slug}.json` !== fileName) {
      throw new Error(`${filePath} slug does not match filename ${parsed.slug}.json`)
    }
  }

  for (const type of ARTIFACT_NODE_TYPES) {
    if (!artifactManifest[type]) {
      throw new Error(`Missing manifest entry for ${type}`)
    }
  }

  const invalid = VisualArtifactSpecSchema.safeParse({
    slug: "bad-artifact",
    title: "Bad artifact",
    nodes: [{ type: "not-real", props: {} }],
  })

  if (invalid.success) {
    throw new Error("Unknown node type should fail validation")
  }

  console.log(`Verified ${files.length} artifact spec(s) and ${ARTIFACT_NODE_TYPES.length} manifest entries.`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
