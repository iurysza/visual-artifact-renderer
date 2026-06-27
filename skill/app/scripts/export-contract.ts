import { promises as fs } from "fs"
import path from "path"
import { fileURLToPath } from "url"

import { artifactComponentManifest, artifactPatternExamples } from "../src/lib/artifact-manifest.js"
import { ARTIFACT_NODE_TYPES } from "../src/lib/artifact-schema.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const contract = {
  version: "1.0.0",
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
        example: entry.example,
        limits: entry.limits,
      },
    ])
  ),
  dataNodes: artifactComponentManifest.filter((e) => e.requiresData).map((e) => e.type),
  patternExamples: artifactPatternExamples,
  globalLimits: {
    dataRowsMax: 20,
    dataStringMax: 200,
  },
}

async function main() {
  const outPath = path.resolve(__dirname, "..", "..", "artifact-contract.json")
  await fs.writeFile(outPath, `${JSON.stringify(contract, null, 2)}\n`, "utf8")
  console.log(`Wrote contract to ${outPath}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
