import { normalizeRequiredOption, resolveApiUrl } from "./register.js";
import { setApiKey } from "./config.js";

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

export async function recoverCreator(options, deps = {}) {
  const wallet = normalizeRequiredOption(options.wallet, "--wallet");
  const signature = normalizeRequiredOption(options.signature, "--signature");
  const apiUrl = resolveApiUrl({ apiUrl: options.apiUrl, env: deps.env });

  const fetchImpl = deps.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw new Error("Fetch implementation is unavailable");
  }

  const response = await fetchImpl(new URL("/api/recover", apiUrl), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ wallet, signature }),
  });

  if (!response.ok) {
    const errorMessage = await parseResponseError(response);
    throw new Error(`Recovery failed (${response.status}): ${errorMessage}`);
  }

  const payload = await response.json();
  const apiKey = payload?.apiKey;
  if (typeof apiKey !== "string" || apiKey.length === 0) {
    throw new Error("Recovery response did not include an API key");
  }

  return { apiKey };
}

export function createRecoverAction(deps = {}) {
  const logger = deps.logger ?? console;
  const saveApiKey = deps.setApiKey ?? setApiKey;
  return async (options) => {
    const { apiKey } = await recoverCreator(options, deps);
    await saveApiKey(apiKey);
    logger.log(`API key: ${apiKey}`);
  };
}
