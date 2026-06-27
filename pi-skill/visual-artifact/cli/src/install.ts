import { existsSync } from "node:fs";
import { mkdir, chmod, symlink, cp } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const binary = resolve(root, "dist", "visual-artifact");

const binDir = resolve(homedir(), ".pi", "bin");
const linkPath = resolve(binDir, "visual-artifact");

async function main() {
  if (!existsSync(binary)) {
    console.error(`[install] Compiled binary not found: ${binary}`);
    console.error("[install] Run `bun run build` first.");
    process.exit(1);
  }

  await mkdir(binDir, { recursive: true });

  try {
    await symlink(binary, linkPath, "file");
    console.error(`[install] Linked ${binary} -> ${linkPath}`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") {
      await cp(binary, linkPath, { force: true });
      console.error(`[install] Replaced ${linkPath}`);
    } else {
      throw error;
    }
  }

  await chmod(linkPath, 0o755);

  if (!process.env.PATH?.split(":").some((p) => resolve(p) === binDir)) {
    console.error(`[install] WARNING: ${binDir} is not on your PATH.`);
    console.error(`[install] Add this to your shell profile:`);
    console.error(`  export PATH="${binDir}:$PATH"`);
  }

  console.error(`[install] visual-artifact is available at ${linkPath}`);
}

main().catch((err) => {
  console.error("[install] failed:", err);
  process.exit(1);
});
