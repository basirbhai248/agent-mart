import { resolveApiKey } from "./config.js";
import { resolveApiUrl } from "./register.js";
import { formatSearchResultsTable } from "./search.js";

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

export async function getMyListings(options = {}, deps = {}) {
  const apiKey = await resolveApiKey({
    env: deps.env,
    configFilePath: deps.configFilePath,
    fsModule: deps.fsModule,
  });
  if (!apiKey) {
    throw new Error("Missing API key. Set AGENTMART_API_KEY or run agentmart register.");
  }

  const apiUrl = resolveApiUrl({ apiUrl: options.apiUrl, env: deps.env });
  const fetchImpl = deps.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw new Error("Fetch implementation is unavailable");
  }

  // Get wallet from /api/me
  const meResponse = await fetchImpl(new URL("/api/me", apiUrl), {
    method: "GET",
    headers: { authorization: `Bearer ${apiKey}` },
  });
  if (!meResponse.ok) {
    const errorMessage = await parseResponseError(meResponse);
    throw new Error(`Failed to load profile (${meResponse.status}): ${errorMessage}`);
  }
  const profile = await meResponse.json();
  const wallet = profile?.wallet;
  if (!wallet) {
    throw new Error("Profile response did not include wallet");
  }

  // Get listings from /api/creators
  const endpoint = new URL("/api/creators", apiUrl);
  endpoint.searchParams.set("wallet", wallet);
  const response = await fetchImpl(endpoint, { method: "GET" });
  if (!response.ok) {
    const errorMessage = await parseResponseError(response);
    throw new Error(`Failed to load listings (${response.status}): ${errorMessage}`);
  }

  const payload = await response.json();
  return payload?.listings ?? [];
}

export function createMyListingsAction(deps = {}) {
  const logger = deps.logger ?? console;
  return async (options) => {
    const listings = await getMyListings(options, deps);
    logger.log(formatSearchResultsTable(listings));
  };
}
