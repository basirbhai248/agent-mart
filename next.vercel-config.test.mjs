import assert from "node:assert/strict";
import test from "node:test";

test("vercel config pins framework and build lifecycle for production deploys", async () => {
  const { default: config } = await import("./vercel.json", {
    with: { type: "json" },
  });

  assert.equal(config.$schema, "https://openapi.vercel.sh/vercel.json");
  assert.equal(config.framework, "nextjs");
  assert.equal(config.installCommand, "npm ci");
  assert.equal(config.buildCommand, "npm run build");
});
