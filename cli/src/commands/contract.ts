import { ConfigValidationError, loadConfig } from "../config.ts"
import { loadContract } from "../contract.ts"
import type { Logger, ResultData } from "../logger.ts"
import type { ArtifactContract, GlobalOpts } from "../types.ts"

interface ContractOpts extends GlobalOpts {
  contract?: string
  format?: string
  node?: string
}

function formatSpecConstraints(spec: ArtifactContract["spec"]): string[] {
  const lines = ["Spec constraints:"]

  const slug = spec.slug
  lines.push(`  slug: ${slug.format}, ${slug.minLength}-${slug.maxLength} chars`)

  lines.push(`  title: ${spec.title.type}, min ${spec.title.minLength}`)

  const desc = spec.description
  lines.push(`  description: ${desc.type}, min ${desc.minLength}${desc.optional ? ", optional" : ""}`)

  lines.push(`  layout.type: ${spec.layout.type.enum.join(", ")}`)
  lines.push(`  layout.columns: ${spec.layout.columns.enum.join(", ")}`)

  lines.push(`  nodes: ${spec.nodes.type}, min ${spec.nodes.minItems}`)

  return lines
}

function printSummary(contract: ArtifactContract): string {
  const lines = [
    `Visualizer artifact contract v${contract.version}`,
    "",
    ...formatSpecConstraints(contract.spec),
    "",
    `Node types: ${contract.nodeTypes.length}`,
    ...contract.nodeTypes.map((nodeType) => {
      const def = contract.nodes[nodeType]
      const oneLine = def?.description?.split("\n")[0] ?? ""
      return `  ${nodeType}${oneLine ? ` — ${oneLine}` : ""}`
    }),
    "",
    `Data-backed node types: ${contract.dataNodes.length}`,
    `Pattern examples: ${Object.keys(contract.patternExamples).join(", ") || "none"}`,
  ]
  return lines.join("\n")
}

function printNode(contract: ArtifactContract, nodeType: string): string {
  return JSON.stringify(contract.nodes[nodeType], null, 2)
}

export async function contract(opts: ContractOpts, log: Logger): Promise<number> {
  let config
  try {
    config = loadConfig({
      overrides: {
        ...(opts.contract !== undefined ? { contractPath: opts.contract } : {}),
        ...(opts.allowRemote !== undefined ? { allowRemote: opts.allowRemote } : {}),
      },
    })
  } catch (error) {
    if (error instanceof ConfigValidationError) {
      log.error(error.message)
      return 2
    }
    log.error(error instanceof Error ? error.message : String(error), error)
    return 1
  }

  if (opts.format && opts.format !== "json" && opts.format !== "summary") {
    log.error(`Invalid format: ${opts.format}. Expected "json" or "summary".`)
    return 2
  }

  let contract: ArtifactContract
  try {
    contract = await loadContract(config.contractPath)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    log.error(`Could not load contract ${config.contractPath ?? "bundled contract"}: ${message}`, error)
    return 1
  }

  if (opts.node) {
    const def = contract.nodes[opts.node]
    if (!def) {
      log.error(`Unknown node type: ${opts.node}`)
      log.info(`Known node types: ${contract.nodeTypes.join(", ")}`)
      return 2
    }
    if (opts.json) {
      log.result({ command: "contract", version: contract.version, type: opts.node, ...def })
      return 0
    }
    if (opts.plain) {
      log.result({ command: "contract", version: contract.version, node: { type: opts.node, ...def } })
      return 0
    }
    process.stdout.write(`${printNode(contract, opts.node)}\n`)
    return 0
  }

  if (opts.format === "summary" || (opts.format === undefined && !opts.json && !opts.plain)) {
    log.result(
      {
        command: "contract",
        version: contract.version,
        spec: contract.spec,
        nodeCount: contract.nodeTypes.length,
        nodeTypes: contract.nodeTypes,
        dataNodeCount: contract.dataNodes.length,
        dataNodes: contract.dataNodes,
        patterns: Object.keys(contract.patternExamples),
      },
      printSummary(contract),
    )
    return 0
  }

  if (opts.json) {
    log.result({ command: "contract", ...contract })
    return 0
  }

  if (opts.plain) {
    log.result({ command: "contract", version: contract.version, nodeTypes: contract.nodeTypes })
    return 0
  }

  process.stdout.write(`${JSON.stringify(contract, null, 2)}\n`)
  return 0
}
