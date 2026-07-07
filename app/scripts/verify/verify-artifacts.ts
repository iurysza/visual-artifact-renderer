import { promises as fs } from "fs"
import path from "path"

import { artifactComponentManifest, artifactManifest } from "../../src/lib/contract/artifact-manifest"
import { ARTIFACT_NODE_TYPES, VisualArtifactSpecSchema } from "../../src/lib/contract/artifact-schema"

async function findArtifactFiles(dir: string): Promise<string[]> {
  const files: string[] = []
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const projectEntry of entries) {
      if (!projectEntry.isDirectory()) continue
      const projectName = projectEntry.name
      const projectDir = path.join(dir, projectName)
      const bundleEntries = await fs.readdir(projectDir, { withFileTypes: true })
      for (const bundleEntry of bundleEntries) {
        if (!bundleEntry.isDirectory()) continue
        const artifactJson = path.join(projectDir, bundleEntry.name, "artifact.json")
        files.push(artifactJson)
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
  }
  return files
}

async function main() {
  const skillRoot = path.resolve(__dirname, "..", "..")
  const artifactsDir = process.env.VISUAL_ARTIFACT_ARTIFACTS_DIR
    ? path.resolve(process.env.VISUAL_ARTIFACT_ARTIFACTS_DIR)
    : path.join(skillRoot, "..", "artifacts")
  const files = await findArtifactFiles(artifactsDir)

  for (const filePath of files) {
    const raw = await fs.readFile(filePath, "utf8")
    const parsed = VisualArtifactSpecSchema.parse(JSON.parse(raw))
    const fileName = path.basename(filePath)
    const slugDir = path.basename(path.dirname(filePath))

    if (fileName !== "artifact.json" || parsed.slug !== slugDir) {
      throw new Error(`${filePath} slug does not match bundle directory ${parsed.slug}`)
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

  const codeBlock = VisualArtifactSpecSchema.safeParse({
    slug: "code-block-contract",
    title: "Code block contract",
    nodes: [
      {
        type: "code-block",
        props: {
          title: "Example snippet",
          language: "typescript",
          code: "const answer: number = 42",
          caption: "Copyable syntax-highlighted snippet",
        },
      },
    ],
  })

  if (!codeBlock.success) {
    throw new Error(`Code block node should pass validation: ${codeBlock.error.message}`)
  }

  const contractPath = path.resolve(__dirname, "..", "..", "..", "cli", "assets", "contract.json")
  const contractRaw = await fs.readFile(contractPath, "utf8")
  const contract = JSON.parse(contractRaw)

  const manifestDataNodes = artifactComponentManifest
    .filter((entry) => entry.requiresData)
    .map((entry) => entry.type)
    .sort()

  const contractDataNodes = [...contract.dataNodes].sort()
  if (JSON.stringify(manifestDataNodes) !== JSON.stringify(contractDataNodes)) {
    throw new Error(
      `Contract dataNodes mismatch: manifest=[${manifestDataNodes.join(", ")}] contract=[${contractDataNodes.join(", ")}]`,
    )
  }

  const contractNodeTypes = [...contract.nodeTypes].sort()
  const schemaNodeTypes = [...ARTIFACT_NODE_TYPES].sort()
  if (JSON.stringify(contractNodeTypes) !== JSON.stringify(schemaNodeTypes)) {
    throw new Error(
      `Contract nodeTypes mismatch: schema=[${schemaNodeTypes.join(", ")}] contract=[${contractNodeTypes.join(", ")}]`,
    )
  }

  for (const type of ARTIFACT_NODE_TYPES) {
    if (!contract.nodes[type]) {
      throw new Error(`Contract missing node definition for ${type}`)
    }
  }

  console.log(`Verified ${files.length} artifact spec(s), ${ARTIFACT_NODE_TYPES.length} manifest entries, contract sync, and code-block contract.`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
