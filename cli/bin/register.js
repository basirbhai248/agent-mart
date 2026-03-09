import { resolvePrivateKey, setApiKey } from "./config.js";

export const DEFAULT_API_URL = "https://agent-mart-beryl.vercel.app";

export function normalizeRequiredOption(value, optionName) {
  if (typeof value !== "string") {
    throw new Error(`${optionName} is required`);
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error(`${optionName} is required`);
  }

  return normalized;
}

export function resolveApiUrl({ apiUrl, env = process.env } = {}) {
  const value = apiUrl ?? env.AGENTMART_API_URL ?? DEFAULT_API_URL;
  return new URL(value).toString();
}

async function buildPaymentFetch({
  privateKey,
  fetchImpl = globalThis.fetch,
  wrapFetchWithPayment,
  privateKeyToAccount,
}) {
  if (typeof fetchImpl !== "function") {
    throw new Error("Fetch implementation is unavailable");
  }

  let wrapPayment = wrapFetchWithPayment;
  if (!wrapPayment) {
    ({ wrapFetchWithPayment: wrapPayment } = await import("@x402/fetch"));
  }

  let toAccount = privateKeyToAccount;
  if (!toAccount) {
    ({ privateKeyToAccount: toAccount } = await import("viem/accounts"));
  }

  const account = toAccount(privateKey);
  return wrapPayment(fetchImpl, { account });
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

export async function registerCreator(options, deps = {}) {
  const wallet = normalizeRequiredOption(options.wallet, "--wallet");
  const displayName = normalizeRequiredOption(options.name, "--name");
  const bio = normalizeRequiredOption(options.bio, "--bio");
  const apiUrl = resolveApiUrl({ apiUrl: options.apiUrl, env: deps.env });

  const getPrivateKey = deps.resolvePrivateKey ?? resolvePrivateKey;
  const privateKey = await getPrivateKey();
  if (!privateKey) {
    throw new Error(
      "Missing private key. Run `agentmart config set private-key <key>` or set EVM_PRIVATE_KEY.",
    );
  }

  const paidFetch = await buildPaymentFetch({
    privateKey,
    fetchImpl: deps.fetchImpl,
    wrapFetchWithPayment: deps.wrapFetchWithPayment,
    privateKeyToAccount: deps.privateKeyToAccount,
  });

  const response = await paidFetch(new URL("/api/register", apiUrl), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ wallet, displayName, bio }),
  });

  if (!response.ok) {
    const errorMessage = await parseResponseError(response);
    throw new Error(`Registration failed (${response.status}): ${errorMessage}`);
  }

  const payload = await response.json();
  const apiKey = payload?.apiKey;
  if (typeof apiKey !== "string" || apiKey.length === 0) {
    throw new Error("Registration response did not include an API key");
  }

  return { apiKey };
}

export function createRegisterAction(deps = {}) {
  const logger = deps.logger ?? console;
  const saveApiKey = deps.setApiKey ?? setApiKey;
  return async (options) => {
    const { apiKey } = await registerCreator(options, deps);
    await saveApiKey(apiKey);
    logger.log(`API key: ${apiKey}`);
  };
}
