import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export function getConfigFilePath({ homedir = os.homedir } = {}) {
  return path.join(homedir(), ".agentmart", "config.json");
}

export async function readConfig({
  configFilePath = getConfigFilePath(),
  fsModule = fs,
} = {}) {
  try {
    const raw = await fsModule.readFile(configFilePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error(`Invalid config file format at ${configFilePath}`);
    }
    return parsed;
  } catch (error) {
    if (error?.code === "ENOENT") {
      return {};
    }
    throw error;
  }
}

export async function setPrivateKey(key, options = {}) {
  const configFilePath = options.configFilePath ?? getConfigFilePath();
  const fsModule = options.fsModule ?? fs;
  const config = await readConfig({ configFilePath, fsModule });

  config.privateKey = key;

  await fsModule.mkdir(path.dirname(configFilePath), { recursive: true });
  await fsModule.writeFile(
    configFilePath,
    `${JSON.stringify(config, null, 2)}\n`,
    "utf8",
  );

  return configFilePath;
}

export async function setApiKey(key, options = {}) {
  const configFilePath = options.configFilePath ?? getConfigFilePath();
  const fsModule = options.fsModule ?? fs;
  const config = await readConfig({ configFilePath, fsModule });

  config.apiKey = key;

  await fsModule.mkdir(path.dirname(configFilePath), { recursive: true });
  await fsModule.writeFile(
    configFilePath,
    `${JSON.stringify(config, null, 2)}\n`,
    "utf8",
  );

  return configFilePath;
}

export async function resolvePrivateKey({
  env = process.env,
  configFilePath = getConfigFilePath(),
  fsModule = fs,
} = {}) {
  const config = await readConfig({ configFilePath, fsModule });
  if (typeof config.privateKey === "string" && config.privateKey.length > 0) {
    return config.privateKey;
  }
  return env.EVM_PRIVATE_KEY || env.PRIVATE_KEY || env.WALLET_PRIVATE_KEY;
}

export async function resolveApiKey({
  env = process.env,
  configFilePath = getConfigFilePath(),
  fsModule = fs,
} = {}) {
  const config = await readConfig({ configFilePath, fsModule });
  if (typeof config.apiKey === "string" && config.apiKey.length > 0) {
    return config.apiKey;
  }
  return env.AGENTMART_API_KEY || env.API_KEY;
}
