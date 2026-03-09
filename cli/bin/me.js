import { resolveApiKey } from "./config.js";
import { resolveApiUrl } from "./register.js";

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

export async function getCurrentCreator(options = {}, deps = {}) {
  const apiKey = await resolveApiKey({
    env: deps.env,
    configFilePath: deps.configFilePath,
    fsModule: deps.fsModule,
  });
  if (!apiKey) {
    throw new Error(
      "Missing API key. Run `agentmart register` or `agentmart recover` first.",
    );
  }

  const apiUrl = resolveApiUrl({ apiUrl: options.apiUrl, env: deps.env });
  const fetchImpl = deps.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw new Error("Fetch implementation is unavailable");
  }

  const response = await fetchImpl(new URL("/api/me", apiUrl), {
    method: "GET",
    headers: {
      authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    const errorMessage = await parseResponseError(response);
    throw new Error(`Failed to load profile (${response.status}): ${errorMessage}`);
  }

  const payload = await response.json();
  const wallet = payload?.wallet;
  const name = payload?.displayName;
  if (
    typeof wallet !== "string" ||
    wallet.length === 0 ||
    typeof name !== "string" ||
    name.length === 0
  ) {
    throw new Error("Profile response did not include wallet and displayName");
  }

  return { wallet, name };
}

export function createMeAction(deps = {}) {
  const logger = deps.logger ?? console;
  return async (options) => {
    const profile = await getCurrentCreator(options, deps);
    logger.log(`Wallet: ${profile.wallet}`);
    logger.log(`Name: ${profile.name}`);
  };
}
