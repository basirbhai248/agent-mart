import { resolveApiKey } from "./config.js";
import { resolveApiUrl } from "./register.js";

export async function getSubscriptionStatus(options = {}, deps = {}) {
  const env = deps.env ?? process.env;
  const logger = deps.logger ?? console;
  const fetchImpl = deps.fetchImpl ?? globalThis.fetch;
  const getApiKey = deps.resolveApiKey ?? resolveApiKey;

  const apiKey = await getApiKey({ env });
  if (!apiKey) {
    throw new Error(
      "Missing API key. Run `agentmart register` first or set AGENTMART_API_KEY.",
    );
  }

  const apiUrl = resolveApiUrl({ env });

  const response = await fetchImpl(new URL("/api/me", apiUrl), {
    method: "GET",
    headers: { authorization: `Bearer ${apiKey}` },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to fetch profile (${response.status}): ${text}`);
  }

  const profile = await response.json();

  if (profile.whitelisted) {
    logger.log("Status: Whitelisted (free)");
  } else if (profile.subscriptionStatus) {
    logger.log(`Status: ${profile.subscriptionStatus}`);
  } else {
    logger.log("Status: none");
  }

  if (profile.subscriptionExpiresAt) {
    const date = new Date(profile.subscriptionExpiresAt).toISOString().split("T")[0];
    logger.log(`Expires: ${date}`);
  }

  if (profile.subscriptionId) {
    logger.log(`Subscription ID: ${profile.subscriptionId}`);
  }

  return profile;
}

export function createSubscriptionStatusAction(deps = {}) {
  return async (options) => {
    await getSubscriptionStatus(options, deps);
  };
}
