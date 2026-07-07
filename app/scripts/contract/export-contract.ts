import { promises as fs } from "fs"
import path from "path"
import { fileURLToPath } from "url"

import { artifactComponentManifest, artifactPatternExamples } from "../../src/lib/contract/artifact-manifest.js"
import { ARTIFACT_NODE_TYPES, ARTIFACT_SPEC_CONSTRAINTS } from "../../src/lib/contract/artifact-schema.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const contract = {
  version: "1.0.0",
  spec: {
    slug: ARTIFACT_SPEC_CONSTRAINTS.slug,
    title: ARTIFACT_SPEC_CONSTRAINTS.title,
    description: ARTIFACT_SPEC_CONSTRAINTS.description,
    layout: {
      type: {
        enum: Array.from(ARTIFACT_SPEC_CONSTRAINTS.layout.type.enum),
      },
      columns: {
        enum: Array.from(ARTIFACT_SPEC_CONSTRAINTS.layout.columns.enum),
      },
    },
    nodes: {
      type: ARTIFACT_SPEC_CONSTRAINTS.nodes.type,
      minItems: ARTIFACT_SPEC_CONSTRAINTS.nodes.minItems,
    },
  },
  nodeTypes: ARTIFACT_NODE_TYPES,
  nodes: Object.fromEntries(
    artifactComponentManifest.map((entry) => [
      entry.type,
      {
        description: entry.description,
        props: entry.props,
        children: entry.children,
        data: entry.data,
        requiresData: entry.requiresData,
        metadata: { id: "string?" },
        example: entry.example,
      },
    ])
  ),
  dataNodes: artifactComponentManifest.filter((e) => e.requiresData).map((e) => e.type),
  patternExamples: artifactPatternExamples,
}

async function main() {
  const outPath = path.resolve(__dirname, "..", "..", "..", "cli", "assets", "contract.json")
  await fs.mkdir(path.dirname(outPath), { recursive: true })
  await fs.writeFile(outPath, `${JSON.stringify(contract, null, 2)}\n`, "utf8")
  console.log(`Wrote contract to ${outPath}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
