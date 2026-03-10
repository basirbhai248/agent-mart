import { NextResponse } from "next/server";
import { createWalletClient, createPublicClient, http, publicActions } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { x402Facilitator } from "@x402/core/facilitator";
import { ExactEvmScheme } from "@x402/evm/exact/facilitator";
import { toFacilitatorEvmSigner } from "@x402/evm";

import { proxyToConvex } from "../../../_lib/proxy";
import {
  buildPaymentRequiredHttpResponse,
  fetchListing,
  getPlatformWalletAddress,
  listingIdFromPath,
} from "./payment";

const DEFAULT_NETWORK = "eip155:8453" as const;
const USDC_ASSET = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

function createLocalFacilitator() {
  const pk = (process.env.FACILITATOR_PRIVATE_KEY || process.env.EVM_PRIVATE_KEY)?.trim();
  if (!pk) {
    throw new Error("FACILITATOR_PRIVATE_KEY or EVM_PRIVATE_KEY is required for payment settlement");
  }

  const account = privateKeyToAccount(pk as `0x${string}`);
  const client = createWalletClient({
    account,
    chain: base,
    transport: http(),
  }).extend(publicActions);

  console.log("[x402] Facilitator address:", account.address);
  const signer = toFacilitatorEvmSigner(client as any);
  const facilitator = new x402Facilitator();
  facilitator.register(DEFAULT_NETWORK, new ExactEvmScheme(signer));

  return facilitator;
}

let _facilitator: x402Facilitator | null = null;
function getFacilitator(): x402Facilitator {
  if (!_facilitator) {
    _facilitator = createLocalFacilitator();
  }
  return _facilitator;
}

function getPaymentHeader(request: Request): string | null {
  return (
    request.headers.get("payment-signature") ||
    request.headers.get("x-payment") ||
    null
  );
}

export async function GET(request: Request): Promise<NextResponse> {
  const listingId = listingIdFromPath(new URL(request.url).pathname);
  if (!listingId) {
    return NextResponse.json({ error: "Listing id is required" }, { status: 400 });
  }

  const paymentHeader = getPaymentHeader(request);
  if (!paymentHeader) {
    const listing = await fetchListing(listingId, request.url);
    if (!listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    const payTo = getPlatformWalletAddress();
    const response = buildPaymentRequiredHttpResponse(
      request.url,
      listing.priceUsdc,
      payTo,
    );

    return new NextResponse(response.body, response);
  }

  // Payment header present — verify and settle via local facilitator
  const listing = await fetchListing(listingId, request.url);
  if (!listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  let paymentPayload;
  try {
    paymentPayload = JSON.parse(
      Buffer.from(paymentHeader, "base64").toString("utf8"),
    );
  } catch {
    return NextResponse.json(
      { error: "Invalid payment header" },
      { status: 400 },
    );
  }

  const payTo = getPlatformWalletAddress();
  const amount = Math.round(listing.priceUsdc * 1_000_000).toString();
  const paymentRequirements = {
    scheme: "exact",
    network: DEFAULT_NETWORK,
    amount,
    asset: USDC_ASSET,
    payTo,
    maxTimeoutSeconds: 300,
    extra: { name: "USDC", version: 2 } as Record<string, unknown>,
  };

  const facilitator = getFacilitator();

  let settleResult;
  try {
    settleResult = await facilitator.settle(paymentPayload, paymentRequirements);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    const errStack = error instanceof Error ? error.stack : undefined;
    console.error("[x402] settlement exception:", errMsg, errStack);
    return NextResponse.json(
      { error: "Payment settlement failed", detail: errMsg },
      { status: 402 },
    );
  }

  if (!settleResult.success) {
    console.error("[x402] settlement rejected:", settleResult.errorReason, settleResult.errorMessage, JSON.stringify(settleResult));
    return NextResponse.json(
      {
        error: "Payment settlement rejected",
        reason: settleResult.errorReason,
        message: settleResult.errorMessage,
        detail: JSON.stringify(settleResult),
      },
      { status: 402 },
    );
  }

  // Settlement succeeded — forward buyer wallet and tx hash to Convex
  const headers = new Headers(request.headers);
  headers.delete("x-x402-verified");
  headers.set("x-buyer-wallet", settleResult.payer ?? "");
  headers.set("x-payment-tx", settleResult.transaction ?? "");

  const response = await proxyToConvex(
    new Request(request.url, { method: request.method, headers }),
    `/api/listing/content?id=${encodeURIComponent(listingId)}`,
  );

  return new NextResponse(await response.arrayBuffer(), {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}
