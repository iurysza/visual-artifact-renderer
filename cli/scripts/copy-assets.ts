import { cp, mkdir, exists } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const assetsDir = resolve(root, "assets");

// Find the project root relative to this script (cli/scripts/copy-assets.ts)
function findProjectRoot(): string {
  let dir = resolve(root, "..");
  for (let i = 0; i < 4; i++) {
    if (
      existsSync(resolve(dir, "app")) &&
      existsSync(resolve(dir, "cli")) &&
      existsSync(resolve(dir, "shared")) &&
      existsSync(resolve(dir, "skill", "SKILL.md"))
    ) {
      return dir;
    }
    dir = resolve(dir, "..");
  }
  throw new Error("Could not find project root (app/ + cli/ + shared/ + skill/SKILL.md).");
}

const projectRoot = findProjectRoot();
const outDir = resolve(projectRoot, "app", "out");
const contractPath = resolve(projectRoot, "cli", "assets", "contract.json");

async function main() {
  const targetOut = resolve(assetsDir, "out");
  const targetContract = resolve(assetsDir, "artifact-contract.json");

  await mkdir(assetsDir, { recursive: true });

  if (await exists(outDir)) {
    await cp(outDir, targetOut, { recursive: true, force: true });
    console.error(`[copy-assets] copied ${outDir} -> ${targetOut}`);
  } else {
    console.error(`[copy-assets] WARNING: app out/ not found at ${outDir}; build the app first`);
  }

  if (await exists(contractPath)) {
    await cp(contractPath, targetContract, { force: true });
    console.error(`[copy-assets] copied ${contractPath} -> ${targetContract}`);
  } else {
    console.error(`[copy-assets] WARNING: artifact-contract.json not found at ${contractPath}`);
  }
}

main().catch((err) => {
  console.error("[copy-assets] failed:", err);
  process.exit(1);
});
