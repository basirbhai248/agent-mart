import assert from "node:assert/strict";
import test from "node:test";

import { BUILD_ENTRY_POINTS, runBuild } from "../scripts/build.mjs";

test("build script includes core convex entry points", () => {
  assert.deepEqual(BUILD_ENTRY_POINTS, [
    "convex/http.ts",
    "convex/mutations.ts",
    "convex/queries.ts",
    "convex/schema.ts",
    "convex/wallet.ts",
  ]);
});

test("build script compiles project entry points", async () => {
  await runBuild();
});
