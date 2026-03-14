import { NextResponse } from "next/server";
import {
  createWalletClient,
  http,
  publicActions,
  getAddress,
  parseAbi,
} from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { createFacilitatorConfig } from "@coinbase/x402";

import { proxyToConvex } from "../../../_lib/proxy";
import {
  buildPaymentRequiredHttpResponse,
  fetchListing,
  getPlatformWalletAddress,
  listingIdFromPath,
} from "./payment";

const DEFAULT_NETWORK = "eip155:8453" as const;
const USDC_ASSET = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

const USDC_ABI = parseAbi([
  "function transfer(address to, uint256 amount) returns (bool)",
]);

// --- CDP Facilitator (handles settlement + gas) ---
let _facilitator: HTTPFacilitatorClient | null = null;
function getFacilitator(): HTTPFacilitatorClient {
  if (!_facilitator) {
    _facilitator = new HTTPFacilitatorClient(createFacilitatorConfig());
    console.log("[settle] Using CDP facilitator for settlement");
  }
  return _facilitator;
}

// --- Platform wallet client (only used for 90% payout transfers) ---
function getPayoutWalletClient() {
  const pk = process.env.FACILITATOR_PRIVATE_KEY?.trim();
  if (!pk) {
    throw new Error("FACILITATOR_PRIVATE_KEY is required for payout transfers");
  }
  const account = privateKeyToAccount(pk as `0x${string}`);
  return createWalletClient({
    account,
    chain: base,
    transport: http(),
  }).extend(publicActions);
}

let _payoutClient: ReturnType<typeof getPayoutWalletClient> | null = null;
function getPayoutClient() {
  if (!_payoutClient) {
    _payoutClient = getPayoutWalletClient();
    console.log("[payout] Payout wallet address:", _payoutClient.account.address);
  }
  return _payoutClient;
}

function getPaymentHeader(request: Request): string | null {
  return (
    request.headers.get("payment-signature") ||
    request.headers.get("x-payment") ||
    null
  );
}

// --- Revenue distribution ---
const CREATOR_SHARE_BPS = 9000; // 90%
const BPS_DENOMINATOR = 10000;

async function distributeRevenue(
  creatorWallet: string,
  grossAmountMicroUsdc: bigint,
): Promise<{ success: boolean; txHash?: string; creatorAmount: bigint; platformAmount: bigint; error?: string }> {
  const creatorAmount = (grossAmountMicroUsdc * BigInt(CREATOR_SHARE_BPS)) / BigInt(BPS_DENOMINATOR);
  const platformAmount = grossAmountMicroUsdc - creatorAmount;

  if (creatorAmount === BigInt(0)) {
    return { success: true, creatorAmount, platformAmount };
  }

  try {
    const client = getPayoutClient();
    const txHash = await client.writeContract({
      address: getAddress(USDC_ASSET),
      abi: USDC_ABI,
      functionName: "transfer",
      args: [getAddress(creatorWallet), creatorAmount],
    });

    console.log("[payout] Sending", creatorAmount.toString(), "micro-USDC to", creatorWallet, "tx:", txHash);
    const receipt = await client.waitForTransactionReceipt({ hash: txHash });
    if (receipt.status !== "success") {
      return { success: false, txHash, creatorAmount, platformAmount, error: "Payout tx reverted" };
    }

    return { success: true, txHash, creatorAmount, platformAmount };
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("[payout] Failed:", errMsg);
    return { success: false, creatorAmount, platformAmount, error: errMsg };
  }
}

async function recordPayoutToConvex(params: {
  listingId: string;
  creatorWallet: string;
  grossAmount: number;
  creatorAmount: number;
  platformAmount: number;
  txHash?: string;
  status: string;
  error?: string;
}): Promise<void> {
  const baseUrl = process.env.CONVEX_SITE_URL?.trim();
  if (!baseUrl) return;

  try {
    await fetch(
      new URL("/api/payout", baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      },
    );
  } catch (e) {
    console.error("[payout] Failed to record payout:", e);
  }
}

async function fetchListingContent(
  listingId: string,
  buyerWallet: string,
  txHash: string,
): Promise<NextResponse | null> {
  const baseUrl = process.env.CONVEX_SITE_URL?.trim();
  if (!baseUrl) return null;

  try {
    const url = new URL(
      `/api/listing?id=${encodeURIComponent(listingId)}`,
      baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`,
    );
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) return null;

    const listing = (await res.json()) as Record<string, unknown>;
    const fileStorageId = listing?.fileStorageId;
    if (typeof fileStorageId !== "string" || !fileStorageId) return null;

    return NextResponse.json({
      listingId,
      buyerWallet,
      hasPurchased: false,
      txHash,
      content: fileStorageId,
    });
  } catch {
    return null;
  }
}

export async function GET(request: Request): Promise<NextResponse> {
  const listingId = listingIdFromPath(new URL(request.url).pathname);
  if (!listingId) {
    return NextResponse.json(
      { error: "Listing id is required" },
      { status: 400 },
    );
  }

  const paymentHeader = getPaymentHeader(request);
  if (!paymentHeader) {
    const listing = await fetchListing(listingId, request.url);
    if (!listing) {
      return NextResponse.json(
        { error: "Listing not found" },
        { status: 404 },
      );
    }
    const payTo = getPlatformWalletAddress();
    const response = buildPaymentRequiredHttpResponse(
      request.url,
      listing.priceUsdc,
      payTo,
    );
    return new NextResponse(response.body, response);
  }

  // Payment header present — verify and settle via CDP facilitator
  const listing = await fetchListing(listingId, request.url);
  if (!listing) {
    return NextResponse.json(
      { error: "Listing not found" },
      { status: 404 },
    );
  }

  let paymentPayload: any;
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

  // Build payment requirements matching our 402 response format
  const paymentRequirements = {
    scheme: "exact" as const,
    network: DEFAULT_NETWORK,
    asset: USDC_ASSET,
    amount,
    payTo,
    maxTimeoutSeconds: 300,
    extra: {
      name: "USD Coin",
      version: "2",
    } as Record<string, unknown>,
  };

  try {
    const facilitator = getFacilitator();
    const settleResult = await facilitator.settle(paymentPayload, paymentRequirements);

    if (!settleResult.success) {
      console.error("[settle] Facilitator failed:", settleResult.errorReason, settleResult.errorMessage);
      return NextResponse.json(
        { error: "Payment settlement failed", detail: settleResult.errorMessage ?? settleResult.errorReason },
        { status: 402 },
      );
    }

    console.log("[settle] CDP facilitator settled! TX:", settleResult.transaction, "payer:", settleResult.payer);

    // Distribute 90% to creator, 10% stays in platform wallet
    if (listing.creatorWallet) {
      const grossMicroUsdc = BigInt(amount);
      const payout = await distributeRevenue(listing.creatorWallet, grossMicroUsdc);
      console.log(
        "[payout] creator:", payout.creatorAmount.toString(),
        "platform:", payout.platformAmount.toString(),
        "success:", payout.success,
      );

      // Record payout (fire-and-forget)
      recordPayoutToConvex({
        listingId,
        creatorWallet: listing.creatorWallet,
        grossAmount: Number(grossMicroUsdc),
        creatorAmount: Number(payout.creatorAmount),
        platformAmount: Number(payout.platformAmount),
        txHash: payout.txHash,
        status: payout.success ? "completed" : "failed",
        error: payout.error,
      });
    }

    // Forward buyer wallet and tx hash to Convex
    const headers = new Headers(request.headers);
    headers.delete("x-x402-verified");
    headers.set("x-buyer-wallet", settleResult.payer ?? "");
    headers.set("x-payment-tx", settleResult.transaction ?? "");

    const response = await proxyToConvex(
      new Request(request.url, { method: request.method, headers }),
      `/api/listing/content?id=${encodeURIComponent(listingId)}`,
    );

    // If Convex returns an error (e.g. invalid storage ID), fall back to
    // returning the raw listing content directly
    if (!response.ok) {
      console.warn(
        "[settle] Convex proxy returned",
        response.status,
        "— falling back to direct content fetch",
      );
      const fallback = await fetchListingContent(
        listingId,
        settleResult.payer ?? "",
        settleResult.transaction ?? "",
      );
      if (fallback) return fallback;
    }

    return new NextResponse(await response.arrayBuffer(), {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("[settle] Exception:", errMsg);
    console.error(
      "[settle] Stack:",
      error instanceof Error ? error.stack : "N/A",
    );
    return NextResponse.json(
      { error: "Payment settlement exception", detail: errMsg },
      { status: 402 },
    );
  }
}
