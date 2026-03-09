import { normalizeRequiredOption, resolveApiUrl } from "./register.js";

async function parseResponseError(response) {
  try {
    const payload = await response.json();
    if (typeof payload?.error === "string" && payload.error.length > 0) {
      return payload.error;
    }
  } catch {
    // Ignore JSON parse errors and fall through to response text.
  }

  const fallback = await response.text();
  return fallback || "Unknown error";
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
  return async (options) => {
    const { apiKey } = await recoverCreator(options, deps);
    logger.log(`API key: ${apiKey}`);
  };
}
