import { promises as fs } from "fs"
import path from "path"
import { fileURLToPath } from "url"

import { createArtifactContract } from "@agents/visual-artifact-annotations/contract"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

async function main() {
  const contract = createArtifactContract()
  const outPath = path.resolve(__dirname, "..", "..", "..", "cli", "assets", "contract.json")
  await fs.mkdir(path.dirname(outPath), { recursive: true })
  await fs.writeFile(outPath, `${JSON.stringify(contract, null, 2)}\n`, "utf8")
  console.log(`Wrote contract to ${outPath}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
