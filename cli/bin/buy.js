import fs from "node:fs/promises";

import { resolvePrivateKey } from "./config.js";
import { recordPurchasedContent } from "./purchases.js";
import { normalizeRequiredOption, resolveApiUrl } from "./register.js";

function defaultOutputPath(listingId) {
  return `${listingId.replace(/[^a-zA-Z0-9._-]/g, "_")}.txt`;
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

async function downloadListingContent(payload, deps = {}) {
  if (typeof payload?.content === "string") {
    return payload.content;
  }

  if (typeof payload?.contentUrl !== "string" || payload.contentUrl.length === 0) {
    throw new Error("Buy response did not include content or contentUrl");
  }

  const fetchImpl = deps.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw new Error("Fetch implementation is unavailable");
  }

  const response = await fetchImpl(payload.contentUrl, { method: "GET" });
  if (!response.ok) {
    throw new Error(`Failed to download content (${response.status})`);
  }

  return await response.text();
}

export async function buyListing(listingIdInput, options = {}, deps = {}) {
  const listingId = normalizeRequiredOption(listingIdInput, "<listing-id>");
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

  const response = await paidFetch(
    new URL(`/api/listings/${encodeURIComponent(listingId)}/content`, apiUrl),
    { method: "GET" },
  );

  if (!response.ok) {
    const errorMessage = await parseResponseError(response);
    throw new Error(`Buy failed (${response.status}): ${errorMessage}`);
  }

  const payload = await response.json();
  if (!payload || typeof payload !== "object") {
    throw new Error("Buy response must be a JSON object");
  }

  const content = await downloadListingContent(payload, deps);
  const outputPath =
    typeof options.output === "string" && options.output.trim().length > 0
      ? options.output.trim()
      : defaultOutputPath(listingId);

  const fsModule = deps.fsModule ?? fs;
  await fsModule.writeFile(outputPath, content, "utf8");
  const savePurchase = deps.recordPurchasedContent ?? recordPurchasedContent;
  await savePurchase(
    { listingId, outputPath, content },
    { configFilePath: deps.configFilePath, fsModule },
  );

  return { listingId, outputPath };
}

export function createBuyAction(deps = {}) {
  const logger = deps.logger ?? console;
  return async (listingId, options) => {
    const { outputPath } = await buyListing(listingId, options, deps);
    logger.log(`Saved content to ${outputPath}`);
  };
}
