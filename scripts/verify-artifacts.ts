import { promises as fs } from "fs"
import path from "path"

import { artifactManifest } from "../src/lib/artifact-manifest"
import { ARTIFACT_NODE_TYPES, VisualArtifactSpecSchema } from "../src/lib/artifact-schema"

async function main() {
  const artifactsDir = path.join(process.cwd(), "src", "artifacts")
  const files = (await fs.readdir(artifactsDir)).filter((file) => file.endsWith(".json"))

  for (const file of files) {
    const raw = await fs.readFile(path.join(artifactsDir, file), "utf8")
    const parsed = VisualArtifactSpecSchema.parse(JSON.parse(raw))

    if (`${parsed.slug}.json` !== file) {
      throw new Error(`${file} slug does not match filename ${parsed.slug}.json`)
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
