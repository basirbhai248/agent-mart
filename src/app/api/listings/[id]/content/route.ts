import { NextResponse } from "next/server";
import { HTTPFacilitatorClient } from "@x402/core/server";

import { proxyToConvex } from "../../../_lib/proxy";
import {
  buildPaymentRequiredHttpResponse,
  fetchListing,
  getPlatformWalletAddress,
  listingIdFromPath,
} from "./payment";

const DEFAULT_NETWORK = "eip155:8453" as const;
const USDC_ASSET = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const facilitator = new HTTPFacilitatorClient();

function getPaymentHeader(request: Request): string | null {
  // x402 v2 uses PAYMENT-SIGNATURE, v1 uses X-PAYMENT
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

  // Payment header present — verify and settle via x402 facilitator
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

  let settleResult;
  try {
    settleResult = await facilitator.settle(paymentPayload, paymentRequirements);
  } catch (error) {
    console.error("x402 settlement failed:", error);
    return NextResponse.json(
      { error: "Payment settlement failed" },
      { status: 402 },
    );
  }

  if (!settleResult.success) {
    return NextResponse.json(
      {
        error: "Payment settlement rejected",
        reason: settleResult.errorReason,
        message: settleResult.errorMessage,
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
