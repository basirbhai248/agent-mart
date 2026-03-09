import { build } from "esbuild";
import { rm, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const BUILD_ENTRY_POINTS = [
  "convex/http.ts",
  "convex/mutations.ts",
  "convex/queries.ts",
  "convex/schema.ts",
  "convex/wallet.ts",
];

export async function runBuild() {
  const outdir = await mkdtemp(join(tmpdir(), "agent-mart-build-"));
  try {
    await build({
      entryPoints: BUILD_ENTRY_POINTS,
      outdir,
      bundle: false,
      format: "esm",
      platform: "node",
      target: "node20",
      logLevel: "silent",
    });
  } finally {
    await rm(outdir, { recursive: true, force: true });
  }
}

const isCli =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isCli) {
  await runBuild();
}
