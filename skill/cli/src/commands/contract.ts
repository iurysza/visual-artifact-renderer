import { loadContract } from "../contract.ts"
import type { Logger } from "../logger.ts"
import type { ArtifactContract, GlobalOpts } from "../types.ts"

interface ContractOpts extends GlobalOpts {
  contract?: string
  format?: string
  node?: string
}

function writeStdout(text: string): void {
  process.stdout.write(`${text}\n`)
}

function outputJson(log: Logger, data: unknown, opts: ContractOpts): void {
  if (opts.json || opts.plain) {
    log.output(data)
  } else {
    writeStdout(JSON.stringify(data, null, 2))
  }
}

function printSummary(log: Logger, contract: ArtifactContract, opts: ContractOpts): void {
  const summary = {
    version: contract.version,
    nodeCount: contract.nodeTypes.length,
    nodeTypes: contract.nodeTypes,
    dataNodeCount: contract.dataNodes.length,
    dataNodes: contract.dataNodes,
    globalLimits: contract.globalLimits,
    patterns: Object.keys(contract.patternExamples),
  }

  if (opts.json || opts.plain) {
    log.output(summary)
    return
  }

  const lines = [
    `Visualizer artifact contract v${contract.version}`,
    "",
    `Node types: ${contract.nodeTypes.length}`,
    ...contract.nodeTypes.map((nodeType) => {
      const def = contract.nodes[nodeType]
      const oneLine = def?.description?.split("\n")[0] ?? ""
      return `  ${nodeType}${oneLine ? ` — ${oneLine}` : ""}`
    }),
    "",
    `Data-backed node types: ${contract.dataNodes.length}`,
    `Global limits: ${JSON.stringify(contract.globalLimits)}`,
    `Pattern examples: ${summary.patterns.join(", ") || "none"}`,
  ]
  writeStdout(lines.join("\n"))
}

function printNode(log: Logger, contract: ArtifactContract, nodeType: string, opts: ContractOpts): number {
  const def = contract.nodes[nodeType]
  if (!def) {
    log.error(`Unknown node type: ${nodeType}`)
    log.info(`Known node types: ${contract.nodeTypes.join(", ")}`)
    return 2
  }
  outputJson(log, def, opts)
  return 0
}

export async function contract(opts: ContractOpts, log: Logger): Promise<number> {
  if (opts.format && opts.format !== "json" && opts.format !== "summary") {
    log.error(`Invalid format: ${opts.format}. Expected "json" or "summary".`)
    return 2
  }

  let contract: ArtifactContract
  try {
    contract = await loadContract(opts.contract)
  } catch (error) {
    log.error(error instanceof Error ? error.message : String(error))
    return 1
  }

  if (opts.node) {
    return printNode(log, contract, opts.node, opts)
  }

  if (opts.format === "summary") {
    printSummary(log, contract, opts)
    return 0
  }

  outputJson(log, contract, opts)
  return 0
}
