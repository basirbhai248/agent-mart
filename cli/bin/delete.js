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

export async function deleteListing(listingIdInput, options = {}, deps = {}) {
  const listingId = normalizeRequiredOption(listingIdInput, "<listing-id>");

  const apiKey = resolveApiKey(options, deps.env);
  if (!apiKey) {
    throw new Error("Missing API key. Set AGENTMART_API_KEY or pass --api-key.");
  }

  const apiUrl = resolveApiUrl({ apiUrl: options.apiUrl, env: deps.env });
  const fetchImpl = deps.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw new Error("Fetch implementation is unavailable");
  }

  const endpoint = new URL("/api/listings", apiUrl);
  endpoint.searchParams.set("id", listingId);

  const response = await fetchImpl(endpoint, {
    method: "DELETE",
    headers: {
      authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    const errorMessage = await parseResponseError(response);
    throw new Error(`Delete failed (${response.status}): ${errorMessage}`);
  }

  return { listingId };
}

export function createDeleteAction(deps = {}) {
  const logger = deps.logger ?? console;
  return async (listingId, options) => {
    const result = await deleteListing(listingId, options, deps);
    logger.log(`Listing deleted: ${result.listingId}`);
  };
}
