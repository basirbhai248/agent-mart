import fs from "node:fs/promises";

import { resolvePrivateKey } from "./config.js";
import { createX402PaymentClient } from "./payment-client.js";
import {
  getPurchasedContent,
  hasContentChanged,
  recordPurchasedContent,
} from "./purchases.js";
import { resolveApiUrl } from "./register.js";

async function buildPaymentFetch({
  privateKey,
  fetchImpl = globalThis.fetch,
  wrapFetchWithPayment,
  privateKeyToAccount,
  x402ClientCtor,
  exactEvmSchemeCtor,
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
  const paymentClient = await createX402PaymentClient({
    account,
    x402ClientCtor,
    exactEvmSchemeCtor,
  });
  return wrapPayment(fetchImpl, paymentClient);
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
    throw new Error("Updates response did not include content or contentUrl");
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

export async function checkPurchasedContentUpdates(options = {}, deps = {}) {
  const apiUrl = resolveApiUrl({ apiUrl: options.apiUrl, env: deps.env });
  const purchases = await getPurchasedContent({
    configFilePath: deps.configFilePath,
    fsModule: deps.fsModule ?? fs,
  });
  if (purchases.length === 0) {
    return { checked: 0, updated: [] };
  }

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
    x402ClientCtor: deps.x402ClientCtor,
    exactEvmSchemeCtor: deps.exactEvmSchemeCtor,
  });
  const fsModule = deps.fsModule ?? fs;
  const savePurchase = deps.recordPurchasedContent ?? recordPurchasedContent;
  const updated = [];

  for (const purchase of purchases) {
    const response = await paidFetch(
      new URL(`/api/listings/${encodeURIComponent(purchase.listingId)}/content`, apiUrl),
      { method: "GET" },
    );
    if (!response.ok) {
      const errorMessage = await parseResponseError(response);
      throw new Error(
        `Updates failed for ${purchase.listingId} (${response.status}): ${errorMessage}`,
      );
    }

    const payload = await response.json();
    if (!payload || typeof payload !== "object") {
      throw new Error("Updates response must be a JSON object");
    }

    const content = await downloadListingContent(payload, deps);
    if (!hasContentChanged(purchase.contentSha256, content)) {
      continue;
    }

    await fsModule.writeFile(purchase.outputPath, content, "utf8");
    await savePurchase(
      {
        listingId: purchase.listingId,
        outputPath: purchase.outputPath,
        content,
      },
      { configFilePath: deps.configFilePath, fsModule },
    );
    updated.push({
      listingId: purchase.listingId,
      outputPath: purchase.outputPath,
    });
  }

  return { checked: purchases.length, updated };
}

export function createUpdatesAction(deps = {}) {
  const logger = deps.logger ?? console;
  return async (options) => {
    const result = await checkPurchasedContentUpdates(options, deps);
    if (result.checked === 0) {
      logger.log("No purchased listings found.");
      return;
    }

    if (result.updated.length === 0) {
      logger.log(`Checked ${result.checked} purchased listing(s). No updates found.`);
      return;
    }

    logger.log(
      `Updated ${result.updated.length} of ${result.checked} purchased listing(s):`,
    );
    for (const item of result.updated) {
      logger.log(`- ${item.listingId} -> ${item.outputPath}`);
    }
  };
}
