import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { spawn } from "node:child_process";

const rootDir = process.cwd();
const scriptPath = path.join(rootDir, "scripts", "e2e-test.sh");

test("scripts/e2e-test.sh completes in dry-run mode", async () => {
  const stdout = await new Promise((resolve, reject) => {
    const child = spawn("bash", [scriptPath], {
      cwd: rootDir,
      env: {
        ...process.env,
        AGENTMART_E2E_DRY_RUN: "true",
      },
    });

    let output = "";
    child.stdout.on("data", (chunk) => {
      output += String(chunk);
    });

    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`e2e script exited ${code}: ${stderr}`));
        return;
      }
      resolve(output);
    });
  });

  assert.match(stdout, /API key:\s+/);
  assert.match(stdout, /Listing created:\s+/);
  assert.match(stdout, /E2E flow completed successfully/);
});
