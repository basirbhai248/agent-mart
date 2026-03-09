import assert from "node:assert/strict";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const cliRoot = path.resolve(import.meta.dirname);
const entrypoint = path.join(cliRoot, "bin", "agentmart.js");

const helpCommands = [
  [],
  ["register"],
  ["recover"],
  ["upload"],
  ["search"],
  ["list"],
  ["buy"],
  ["me"],
  ["updates"],
  ["config"],
  ["config", "set"],
  ["config", "set", "private-key"],
];

test("every CLI command path parses with --help", () => {
  for (const parts of helpCommands) {
    const proc = spawnSync("node", [entrypoint, ...parts, "--help"], {
      cwd: cliRoot,
      encoding: "utf8",
    });

    const label = parts.length > 0 ? parts.join(" ") : "(root)";
    assert.equal(proc.status, 0, `${label} exited with ${proc.status}: ${proc.stderr}`);
  }
});
