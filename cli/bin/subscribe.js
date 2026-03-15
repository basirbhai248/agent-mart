import { resolveApiKey } from "./config.js";

const DEFAULT_API_URL = "https://agent-mart-beryl.vercel.app";

function resolveApiUrl({ env = process.env } = {}) {
  return env.AGENTMART_API_URL || DEFAULT_API_URL;
}

export async function subscribe(options, deps = {}) {
  const env = deps.env ?? process.env;
  const logger = deps.logger ?? console;
  const fetchImpl = deps.fetchImpl ?? globalThis.fetch;
  const getApiKey = deps.resolveApiKey ?? resolveApiKey;

  const apiKey = await getApiKey();
  if (!apiKey) {
    throw new Error(
      "Missing API key. Run `agentmart register` first or set AGENTMART_API_KEY.",
    );
  }

  const apiUrl = resolveApiUrl({ env });

  // Step 1: Get subscription params from platform (including CDP wallet address)
  logger.log("Fetching subscription parameters...");
  const setupRes = await fetchImpl(new URL("/api/subscription/setup", apiUrl));
  if (!setupRes.ok) {
    const err = await setupRes.text();
    throw new Error(`Failed to get subscription setup: ${err}`);
  }
  const setup = await setupRes.json();
  logger.log(
    `Subscription: $${setup.amountUsdc} USDC / ${setup.periodDays} days`,
  );

  // Step 2: Create subscription via Base Pay spend permission
  // Agent signs once — grants platform wallet right to charge periodically
  logger.log("Creating subscription (you will be prompted to sign)...");

  const { base } = await import("@base-org/account");

  const subscription = await base.subscription.subscribe({
    recurringCharge: setup.amountUsdc,
    subscriptionOwner: setup.subscriptionOwner,
    periodInDays: setup.periodDays,
  });

  logger.log(`Subscription created! ID: ${subscription.id}`);

  // Step 3: Report subscription to platform
  logger.log("Activating subscription on platform...");
  const activateRes = await fetchImpl(
    new URL("/api/subscription/activate", apiUrl),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        subscriptionId: subscription.id,
        subscriptionPayer: subscription.subscriptionPayer,
      }),
    },
  );

  if (!activateRes.ok) {
    const err = await activateRes.text();
    throw new Error(
      `Failed to activate subscription: ${err}`,
    );
  }

  const result = await activateRes.json();
  const expiresDate = new Date(result.expiresAt).toISOString().split("T")[0];
  logger.log(`Subscription active! Expires: ${expiresDate}`);
  logger.log(`Subscription ID: ${subscription.id}`);

  return result;
}

export function createSubscribeAction(deps = {}) {
  return async (options) => {
    await subscribe(options, deps);
  };
}
