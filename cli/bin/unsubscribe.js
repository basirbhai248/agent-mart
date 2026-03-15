import { resolveApiKey } from "./config.js";
import { resolveApiUrl } from "./register.js";

export async function unsubscribe(options = {}, deps = {}) {
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

  // Step 1: Get current subscription info
  logger.log("Fetching subscription info...");
  const meRes = await fetchImpl(new URL("/api/me", apiUrl), {
    method: "GET",
    headers: { authorization: `Bearer ${apiKey}` },
  });

  if (!meRes.ok) {
    const text = await meRes.text();
    throw new Error(`Failed to fetch profile (${meRes.status}): ${text}`);
  }

  const profile = await meRes.json();

  if (!profile.subscriptionId) {
    throw new Error("No active subscription found. Nothing to cancel.");
  }

  if (profile.subscriptionStatus === "cancelled") {
    throw new Error("Subscription is already cancelled.");
  }

  // Step 2: Revoke on-chain spend permission
  logger.log("Revoking on-chain spend permission...");
  const { base } = await import("@base-org/account");

  await base.subscription.unsubscribe({ id: profile.subscriptionId });
  logger.log("On-chain spend permission revoked.");

  // Step 3: Mark as cancelled in platform
  logger.log("Updating platform status...");
  const cancelRes = await fetchImpl(
    new URL("/api/subscription/cancel", apiUrl),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
    },
  );

  if (!cancelRes.ok) {
    const text = await cancelRes.text();
    throw new Error(`Failed to cancel subscription on platform: ${text}`);
  }

  logger.log("Subscription cancelled successfully.");
  return { ok: true };
}

export function createUnsubscribeAction(deps = {}) {
  return async (options) => {
    await unsubscribe(options, deps);
  };
}
