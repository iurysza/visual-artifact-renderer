import { readFileSync } from "node:fs";
import { validateMermaid, formatValidationReport } from "../src/lib/mermaid-validator";

function help() {
  console.log(`
Usage:
  npx tsx scripts/validate-mermaid.ts <file.mmd>
  npx tsx scripts/validate-mermaid.ts --inline "flowchart TD\n  A --> B"
  npx tsx scripts/validate-mermaid.ts --json <file.mmd>
  npx tsx scripts/validate-mermaid.ts --json --inline "..."

Options:
  --inline   Validate a diagram string passed inline (use \\n for newlines)
  --json     Output structured JSON instead of a human-readable report
  --quiet    Exit with non-zero code on errors but print nothing
  --help     Show this help
`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes("--help")) {
    help();
    process.exit(args.includes("--help") ? 0 : 1);
  }

  const json = args.includes("--json");
  const quiet = args.includes("--quiet");
  const inline = args.includes("--inline");
  const positional = args.filter((a) => !a.startsWith("--"));

  let input: string;
  if (inline) {
    const idx = args.indexOf("--inline");
    input = args[idx + 1];
    if (!input) {
      console.error("Error: --inline requires a diagram string.");
      process.exit(1);
    }
    input = input.replace(/\\n/g, "\n");
  } else {
    const file = positional[0];
    if (!file) {
      console.error("Error: provide a file path or use --inline.");
      process.exit(1);
    }
    input = readFileSync(file, "utf-8");
  }

  const result = await validateMermaid(input);

  if (quiet) {
    process.exit(result.valid ? 0 : 1);
  }

  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(formatValidationReport(result));
  }

  process.exit(result.valid ? 0 : 1);
}

main();
