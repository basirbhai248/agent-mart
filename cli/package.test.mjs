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

  assert.equal(pkg.dependencies["@x402/evm"], "^2.6.0");
  assert.equal(pkg.dependencies.commander, "latest");
  assert.equal(pkg.dependencies["@x402/fetch"], "^2.6.0");
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
    "list",
    "buy",
    "updates",
    "me",
    "config",
  ]) {
    assert.match(binContents, new RegExp(`["']${commandName}["']`));
  }

  assert.match(binContents, /["']search <query>["']/);
  assert.match(binContents, /["']upload <file>["']/);
  assert.match(binContents, /["']set["']/);
  assert.match(binContents, /["']private-key <key>["']/);
});

test("cli README includes install instructions and usage examples", async () => {
  const readmePath = path.join(root, "README.md");
  const readme = await fs.readFile(readmePath, "utf8");

  assert.match(readme, /npm install -g agentmart/);

  for (const example of [
    "agentmart register",
    "agentmart recover",
    "agentmart upload",
    "agentmart search",
    "agentmart list",
    "agentmart buy",
    "agentmart me",
    "agentmart updates",
    "agentmart config set private-key",
  ]) {
    assert.match(readme, new RegExp(example));
  }
});
