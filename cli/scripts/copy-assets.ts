import { cp, mkdir, exists } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const assetsDir = resolve(root, "assets");

// Find the skill root relative to this script (skill/cli/scripts/copy-assets.ts)
function findSkillRoot(): string {
  let dir = resolve(root, "..");
  for (let i = 0; i < 3; i++) {
    if (existsSync(resolve(dir, "SKILL.md"))) return dir;
    dir = resolve(dir, "..");
  }
  throw new Error("Could not find skill root (SKILL.md).");
}

const skillRoot = findSkillRoot();
const outDir = resolve(skillRoot, "app", "out");
const contractPath = resolve(skillRoot, "artifact-contract.json");

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
