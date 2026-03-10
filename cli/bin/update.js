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
  if (value === undefined || value === null) {
    return undefined;
  }

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

export async function updateListing(listingIdInput, options = {}, deps = {}) {
  const listingId = normalizeRequiredOption(listingIdInput, "<listing-id>");

  const apiKey = resolveApiKey(options, deps.env);
  if (!apiKey) {
    throw new Error("Missing API key. Set AGENTMART_API_KEY or pass --api-key.");
  }

  const body = { listingId };

  if (options.title) body.title = options.title.trim();
  if (options.description) body.description = options.description.trim();

  const priceUsdc = parsePrice(options.price);
  if (priceUsdc !== undefined) body.priceUsdc = priceUsdc;

  if (options.file) {
    const filePath = options.file.trim();
    if (!filePath.endsWith(".md")) {
      throw new Error("Only .md (markdown) files are supported");
    }
    const fsModule = deps.fsModule ?? fs;
    const rawFile = await fsModule.readFile(filePath, "utf8");
    const content = rawFile.trim();
    if (content.length === 0) {
      throw new Error("File content cannot be empty");
    }
    body.fileStorageId = content;
  }

  if (!body.title && !body.description && !body.priceUsdc && !body.fileStorageId) {
    throw new Error("At least one field to update is required (--title, --description, --price, --file)");
  }

  const apiUrl = resolveApiUrl({ apiUrl: options.apiUrl, env: deps.env });
  const fetchImpl = deps.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw new Error("Fetch implementation is unavailable");
  }

  const response = await fetchImpl(new URL("/api/listings", apiUrl), {
    method: "PUT",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorMessage = await parseResponseError(response);
    throw new Error(`Update failed (${response.status}): ${errorMessage}`);
  }

  return { listingId };
}

export function createUpdateAction(deps = {}) {
  const logger = deps.logger ?? console;
  return async (listingId, options) => {
    const result = await updateListing(listingId, options, deps);
    logger.log(`Listing updated: ${result.listingId}`);
  };
}
