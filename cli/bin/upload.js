import fs from "node:fs/promises";

import { normalizeRequiredOption, resolveApiUrl } from "./register.js";

function resolveApiKey(options, env = process.env) {
  const optionApiKey = options?.apiKey;
  if (typeof optionApiKey === "string" && optionApiKey.trim().length > 0) {
    return optionApiKey.trim();
  }

  const envApiKey = env.AGENTMART_API_KEY ?? env.API_KEY;
  if (typeof envApiKey === "string" && envApiKey.trim().length > 0) {
    return envApiKey.trim();
  }

  return undefined;
}

function parsePrice(value) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const parsed = Number(value.trim());
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined;
  }

  return parsed;
}

async function parseResponseError(response) {
  const text = await response.text();
  try {
    const payload = JSON.parse(text);
    if (typeof payload?.error === "string" && payload.error.length > 0) {
      return payload.error;
    }
  } catch {
    // not JSON
  }
  return text || "Unknown error";
}

export async function uploadListing(file, options, deps = {}) {
  const filePath = normalizeRequiredOption(file, "<file>");
  const title = normalizeRequiredOption(options.title, "--title");
  const description = normalizeRequiredOption(options.description, "--description");
  const priceUsdc = parsePrice(options.price);
  if (priceUsdc === undefined) {
    throw new Error("--price must be a positive number");
  }

  const apiKey = resolveApiKey(options, deps.env);
  if (!apiKey) {
    throw new Error("Missing API key. Set AGENTMART_API_KEY or pass --api-key.");
  }

  const fsModule = deps.fsModule ?? fs;
  const rawFile = await fsModule.readFile(filePath, "utf8");
  const fileStorageId = rawFile.trim();
  if (fileStorageId.length === 0) {
    throw new Error("File content cannot be empty");
  }

  const apiUrl = resolveApiUrl({ apiUrl: options.apiUrl, env: deps.env });
  const fetchImpl = deps.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw new Error("Fetch implementation is unavailable");
  }

  const response = await fetchImpl(new URL("/api/listings", apiUrl), {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      title,
      description,
      priceUsdc,
      fileStorageId,
    }),
  });

  if (!response.ok) {
    const errorMessage = await parseResponseError(response);
    throw new Error(`Upload failed (${response.status}): ${errorMessage}`);
  }

  const payload = await response.json();
  const listingId = payload?.listingId;
  if (typeof listingId !== "string" || listingId.length === 0) {
    throw new Error("Upload response did not include a listing id");
  }

  return { listingId };
}

export function createUploadAction(deps = {}) {
  const logger = deps.logger ?? console;
  return async (file, options) => {
    const { listingId } = await uploadListing(file, options, deps);
    logger.log(`Listing created: ${listingId}`);
  };
}
