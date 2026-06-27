import { cp, mkdir, exists } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const assetsDir = resolve(root, "assets");

// Try the canonical visualizer repo path first; allow override via env.
const visualizerRoot = process.env.VISUALIZER_ROOT
  ? resolve(process.env.VISUALIZER_ROOT)
  : "/Users/iurysouza/projects/my-repos/vibe-coded/visualizer";

const outDir = resolve(visualizerRoot, "out");
const contractPath = resolve(visualizerRoot, "artifact-contract.json");

async function main() {
  const targetOut = resolve(assetsDir, "out");
  const targetContract = resolve(assetsDir, "artifact-contract.json");

  await mkdir(assetsDir, { recursive: true });

  if (await exists(outDir)) {
    await cp(outDir, targetOut, { recursive: true, force: true });
    console.error(`[copy-assets] copied ${outDir} -> ${targetOut}`);
  } else {
    console.error(`[copy-assets] WARNING: visualizer out/ not found at ${outDir}; serving will fail without static assets`);
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
