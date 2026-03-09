import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname);

test("cli package metadata matches required contract", async () => {
  const pkgPath = path.join(root, "package.json");
  const pkg = JSON.parse(await fs.readFile(pkgPath, "utf8"));

  assert.equal(pkg.name, "agentmart");
  assert.equal(pkg.type, "module");
  assert.deepEqual(pkg.bin, { agentmart: "./bin/agentmart.js" });

  assert.equal(pkg.dependencies.commander, "latest");
  assert.equal(pkg.dependencies["@x402/fetch"], "latest");
  assert.equal(pkg.dependencies.viem, "latest");
});

test("cli entrypoint exists and has a node shebang", async () => {
  const binPath = path.join(root, "bin", "agentmart.js");
  const binContents = await fs.readFile(binPath, "utf8");

  assert.match(binContents, /^#!\/usr\/bin\/env node\n/);
});

test("cli help lists the supported subcommands", async () => {
  const binPath = path.join(root, "bin", "agentmart.js");
  const binContents = await fs.readFile(binPath, "utf8");

  for (const commandName of [
    "register",
    "recover",
    "search",
    "list",
    "buy",
    "updates",
    "me",
    "config",
  ]) {
    assert.match(binContents, new RegExp(`["']${commandName}["']`));
  }

  assert.match(binContents, /["']upload <file>["']/);
  assert.match(binContents, /["']set["']/);
  assert.match(binContents, /["']private-key <key>["']/);
});
