import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  resolveApiKey,
  resolvePrivateKey,
  setApiKey,
  setPrivateKey,
} from "./bin/config.js";

test("config set private-key stores key in ~/.agentmart/config.json", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "agentmart-config-"));
  const configFilePath = path.join(tmpDir, ".agentmart", "config.json");
  await setPrivateKey("0xabc123", { configFilePath });

  const written = JSON.parse(await fs.readFile(configFilePath, "utf8"));
  assert.equal(written.privateKey, "0xabc123");
});

test("config set private-key preserves existing config keys", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "agentmart-config-"));
  const configFilePath = path.join(tmpDir, ".agentmart", "config.json");
  await fs.mkdir(path.dirname(configFilePath), { recursive: true });
  await fs.writeFile(
    configFilePath,
    `${JSON.stringify({ network: "base-sepolia" }, null, 2)}\n`,
    "utf8",
  );

  await setPrivateKey("0xdef456", { configFilePath });
  const written = JSON.parse(await fs.readFile(configFilePath, "utf8"));

  assert.equal(written.network, "base-sepolia");
  assert.equal(written.privateKey, "0xdef456");
});

test("resolvePrivateKey reads config first and falls back to env vars", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "agentmart-config-"));
  const configFilePath = path.join(tmpDir, ".agentmart", "config.json");

  await setPrivateKey("0xfrom-config", { configFilePath });
  assert.equal(
    await resolvePrivateKey({
      configFilePath,
      env: {
        EVM_PRIVATE_KEY: "0xevm",
        PRIVATE_KEY: "0xprivate",
        WALLET_PRIVATE_KEY: "0xwallet",
      },
    }),
    "0xfrom-config",
  );

  await fs.rm(configFilePath);
  assert.equal(
    await resolvePrivateKey({
      configFilePath,
      env: {
        EVM_PRIVATE_KEY: "0xevm",
        PRIVATE_KEY: "0xprivate",
        WALLET_PRIVATE_KEY: "0xwallet",
      },
    }),
    "0xevm",
  );
  assert.equal(
    await resolvePrivateKey({
      configFilePath,
      env: {
        PRIVATE_KEY: "0xprivate",
        WALLET_PRIVATE_KEY: "0xwallet",
      },
    }),
    "0xprivate",
  );
  assert.equal(
    await resolvePrivateKey({
      configFilePath,
      env: {
        WALLET_PRIVATE_KEY: "0xwallet",
      },
    }),
    "0xwallet",
  );
});

test("setApiKey and resolveApiKey use config first then env vars", async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "agentmart-config-"));
  const configFilePath = path.join(tmpDir, ".agentmart", "config.json");

  await setApiKey("api_from_config", { configFilePath });
  assert.equal(
    await resolveApiKey({
      configFilePath,
      env: { AGENTMART_API_KEY: "api_from_env", API_KEY: "api_from_fallback" },
    }),
    "api_from_config",
  );

  await fs.rm(configFilePath);
  assert.equal(
    await resolveApiKey({
      configFilePath,
      env: { AGENTMART_API_KEY: "api_from_env", API_KEY: "api_from_fallback" },
    }),
    "api_from_env",
  );
  assert.equal(
    await resolveApiKey({
      configFilePath,
      env: { API_KEY: "api_from_fallback" },
    }),
    "api_from_fallback",
  );
});
