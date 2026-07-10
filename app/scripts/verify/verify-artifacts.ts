import { promises as fs } from "fs"
import path from "path"

import {
  ARTIFACT_NODE_TYPES,
  ARTIFACT_SPEC_RESOURCE_LIMITS,
  ArtifactNodeSchema,
  VisualArtifactSpecSchema,
  artifactComponentManifest,
  artifactManifest,
  createArtifactContract,
  parseRawArtifactJson,
} from "../../src/lib/contract/artifact-manifest"
import { readArtifactFileBounded } from "../../src/lib/artifacts/read-artifact-file"

const EXCLUDED_NAMES = new Set(["annotations.json", "publish.json"])

async function findArtifactSpecFiles(dir: string): Promise<string[]> {
  const files: string[] = []
  async function walk(current: string) {
    let entries
    try {
      entries = await fs.readdir(current, { withFileTypes: true })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return
      throw error
    }
    for (const entry of entries) {
      const entryPath = path.join(current, entry.name)
      if (entry.isDirectory()) {
        await walk(entryPath)
      } else if (entry.name.endsWith(".json") && !EXCLUDED_NAMES.has(entry.name)) {
        files.push(entryPath)
      }
    }
  }
  await walk(dir)
  return files
}

async function findBundleArtifactFiles(dir: string): Promise<string[]> {
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

async function validateFixture(filePath: string): Promise<void> {
  const raw = await readArtifactFileBounded(filePath)
  const parsed = parseRawArtifactJson(raw)
  const result = VisualArtifactSpecSchema.safeParse(parsed)
  if (!result.success) {
    throw new Error(`${filePath} fixture failed validation: ${result.error.message}`)
  }
}

async function main() {
  const skillRoot = path.resolve(__dirname, "..", "..")
  const artifactsDir = process.env.VISUAL_ARTIFACT_ARTIFACTS_DIR
    ? path.resolve(process.env.VISUAL_ARTIFACT_ARTIFACTS_DIR)
    : path.join(skillRoot, "..", "artifacts")

  // Recursively validate every parseable artifact spec JSON under artifacts,
  // excluding known non-spec files.
  const specFiles = await findArtifactSpecFiles(artifactsDir)
  let validatedCount = 0
  for (const filePath of specFiles) {
    const raw = await readArtifactFileBounded(filePath)
    let parsed: unknown
    try {
      parsed = parseRawArtifactJson(raw)
    } catch {
      continue
    }
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !Array.isArray((parsed as Record<string, unknown>).nodes)
    ) {
      continue
    }
    const result = VisualArtifactSpecSchema.safeParse(parsed)
    if (!result.success) {
      throw new Error(`${filePath} failed validation: ${result.error.message}`)
    }
    validatedCount++
  }

  // Bundle artifact.json files must also have slugs matching their directory.
  const bundleFiles = await findBundleArtifactFiles(artifactsDir)
  for (const filePath of bundleFiles) {
    const raw = await readArtifactFileBounded(filePath)
    const parsed = VisualArtifactSpecSchema.parse(parseRawArtifactJson(raw))
    const slugDir = path.basename(path.dirname(filePath))
    if (parsed.slug !== slugDir) {
      throw new Error(`${filePath} slug does not match bundle directory ${parsed.slug}`)
    }
  }

  // Validate tracked compatibility fixtures in clean CI.
  const fixturesDir = path.resolve(skillRoot, "..", "shared", "fixtures", "valid")
  const fixtureEntries = await fs.readdir(fixturesDir, { withFileTypes: true }).catch(() => [])
  for (const entry of fixtureEntries) {
    if (!entry.name.endsWith(".json")) continue
    await validateFixture(path.join(fixturesDir, entry.name))
  }

  const expectedNodeTypes = [...ARTIFACT_NODE_TYPES].sort()
  const manifestNodeTypes = Object.keys(artifactManifest).sort()
  if (JSON.stringify(manifestNodeTypes) !== JSON.stringify(expectedNodeTypes)) {
    throw new Error(
      `Manifest nodeTypes mismatch: expected=[${expectedNodeTypes.join(", ")}] manifest=[${manifestNodeTypes.join(", ")}]`,
    )
  }

  // Every manifest example must parse as an ArtifactNode.
  for (const entry of artifactComponentManifest) {
    const result = ArtifactNodeSchema.safeParse(entry.example)
    if (!result.success) {
      throw new Error(`Manifest example for ${entry.type} failed node validation: ${result.error.message}`)
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
  const contractDefinitionTypes = Object.keys(contract.nodes).sort()
  if (
    JSON.stringify(contractNodeTypes) !== JSON.stringify(expectedNodeTypes) ||
    JSON.stringify(contractDefinitionTypes) !== JSON.stringify(expectedNodeTypes)
  ) {
    throw new Error(
      `Contract nodeTypes mismatch: expected=[${expectedNodeTypes.join(", ")}] nodeTypes=[${contractNodeTypes.join(", ")}] definitions=[${contractDefinitionTypes.join(", ")}]`,
    )
  }

  // Generated contract must be byte-for-byte equal to createArtifactContract().
  const expectedContract = createArtifactContract()
  if (JSON.stringify(contract) !== JSON.stringify(expectedContract)) {
    throw new Error(
      `Generated contract at ${contractPath} does not match createArtifactContract(). Run \`pnpm export:contract\` and commit the result.`,
    )
  }

  // Limits must be present and match the shared resource envelope.
  if (!contract.limits) {
    throw new Error("Generated contract is missing limits")
  }
  for (const [key, value] of Object.entries(ARTIFACT_SPEC_RESOURCE_LIMITS)) {
    if (contract.limits[key] !== value) {
      throw new Error(
        `Contract limit mismatch for ${key}: expected ${value}, got ${contract.limits[key]}`,
      )
    }
  }

  console.log(
    `Verified ${validatedCount} artifact spec(s) (${bundleFiles.length} bundles), ${ARTIFACT_NODE_TYPES.length} manifest entries, manifest examples, contract sync, limits, and code-block contract.`,
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
