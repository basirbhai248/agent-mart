import test from "node:test";
import assert from "node:assert/strict";

import nextConfig from "./next.config.ts";

test("next config exposes convex rewrite when NEXT_PUBLIC_CONVEX_URL is set", async () => {
  process.env.NEXT_PUBLIC_CONVEX_URL = "https://example.convex.cloud";
  const rewrites = await nextConfig.rewrites();

  assert.deepEqual(rewrites, [
    {
      source: "/convex/:path*",
      destination: "https://example.convex.cloud/:path*",
    },
  ]);
});

test("next config returns no rewrites without NEXT_PUBLIC_CONVEX_URL", async () => {
  delete process.env.NEXT_PUBLIC_CONVEX_URL;
  const rewrites = await nextConfig.rewrites();

  assert.deepEqual(rewrites, []);
});

test("package scripts keep convex build while adding next lifecycle scripts", async () => {
  const { default: pkg } = await import("./package.json", {
    with: { type: "json" },
  });

  assert.equal(pkg.scripts.dev, "next dev");
  assert.equal(pkg.scripts.build, "next build --webpack");
  assert.equal(pkg.scripts.start, "next start");
  assert.equal(pkg.scripts["build:convex"], "node scripts/build.mjs");
});

test("package dependencies include convex and server-side x402 integration", async () => {
  const { default: pkg } = await import("./package.json", {
    with: { type: "json" },
  });

  assert.ok(pkg.dependencies.convex);
  assert.ok(pkg.dependencies["@x402/next"]);
});
