import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { getConfigFilePath, readConfig } from "./config.js";

function normalizePath(value, fallback) {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : fallback;
}

function toHash(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function normalizeEntry(entry) {
  if (!entry || typeof entry !== "object") {
    return null;
  }
  if (typeof entry.listingId !== "string" || entry.listingId.length === 0) {
    return null;
  }

  return {
    listingId: entry.listingId,
    outputPath: normalizePath(entry.outputPath, `${entry.listingId}.txt`),
    contentSha256:
      typeof entry.contentSha256 === "string" && entry.contentSha256.length > 0
        ? entry.contentSha256
        : undefined,
  };
}

export async function getPurchasedContent(options = {}) {
  const config = await readConfig({
    configFilePath: options.configFilePath ?? getConfigFilePath(),
    fsModule: options.fsModule ?? fs,
  });

  if (!Array.isArray(config.purchases)) {
    return [];
  }

  return config.purchases.map(normalizeEntry).filter((entry) => entry !== null);
}

export async function recordPurchasedContent(
  { listingId, outputPath, content },
  options = {},
) {
  const configFilePath = options.configFilePath ?? getConfigFilePath();
  const fsModule = options.fsModule ?? fs;
  const config = await readConfig({ configFilePath, fsModule });
  const purchases = Array.isArray(config.purchases) ? config.purchases : [];
  const normalizedOutputPath = normalizePath(outputPath, `${listingId}.txt`);
  const nextEntry = {
    listingId,
    outputPath: normalizedOutputPath,
    contentSha256: toHash(content),
  };

  const index = purchases.findIndex((entry) => entry?.listingId === listingId);
  if (index >= 0) {
    purchases[index] = nextEntry;
  } else {
    purchases.push(nextEntry);
  }

  config.purchases = purchases;
  await fsModule.mkdir(path.dirname(configFilePath), { recursive: true });
  await fsModule.writeFile(
    configFilePath,
    `${JSON.stringify(config, null, 2)}\n`,
    "utf8",
  );
}

export function hasContentChanged(previousHash, content) {
  if (typeof previousHash !== "string" || previousHash.length === 0) {
    return true;
  }

  return toHash(content) !== previousHash;
}
