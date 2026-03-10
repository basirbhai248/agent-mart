import { NextResponse } from "next/server";
import {
  createWalletClient,
  http,
  publicActions,
  getAddress,
  hashTypedData,
  recoverAddress,
  parseAbi,
} from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

import { proxyToConvex } from "../../../_lib/proxy";
import {
  buildPaymentRequiredHttpResponse,
  fetchListing,
  getPlatformWalletAddress,
  listingIdFromPath,
} from "./payment";

const DEFAULT_NETWORK = "eip155:8453" as const;
const USDC_ASSET = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

const EIP3009_TYPES = {
  TransferWithAuthorization: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "validAfter", type: "uint256" },
    { name: "validBefore", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

const USDC_ABI = parseAbi([
  "function transferWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s)",
  "function balanceOf(address) view returns (uint256)",
]);

function getFacilitatorClient() {
  const pk = (
    process.env.FACILITATOR_PRIVATE_KEY || process.env.EVM_PRIVATE_KEY
  )?.trim();
  if (!pk) {
    throw new Error(
      "FACILITATOR_PRIVATE_KEY or EVM_PRIVATE_KEY is required for payment settlement",
    );
  }
  const account = privateKeyToAccount(pk as `0x${string}`);
  return createWalletClient({
    account,
    chain: base,
    transport: http(),
  }).extend(publicActions);
}

let _client: ReturnType<typeof getFacilitatorClient> | null = null;
function getClient() {
  if (!_client) {
    _client = getFacilitatorClient();
    console.log("[settle] Facilitator address:", _client.account.address);
  }
  return _client;
}

function getPaymentHeader(request: Request): string | null {
  return (
    request.headers.get("payment-signature") ||
    request.headers.get("x-payment") ||
    null
  );
}

interface EIP3009Authorization {
  from: string;
  to: string;
  value: string;
  validAfter: string;
  validBefore: string;
  nonce: string;
}

async function settlePayment(
  authorization: EIP3009Authorization,
  signature: string,
  expectedAmount: string,
  expectedPayTo: string,
) {
  const client = getClient();

  // Verify authorization fields
  if (getAddress(authorization.to) !== getAddress(expectedPayTo)) {
    return { success: false as const, error: "Recipient mismatch" };
  }
  if (BigInt(authorization.value) !== BigInt(expectedAmount)) {
    return { success: false as const, error: "Amount mismatch" };
  }
  const now = Math.floor(Date.now() / 1000);
  if (BigInt(authorization.validBefore) < BigInt(now)) {
    return { success: false as const, error: "Authorization expired" };
  }

  // Verify signature locally via ecrecover
  const domain = {
    name: "USD Coin" as const,
    version: "2" as const,
    chainId: 8453,
    verifyingContract: getAddress(USDC_ASSET),
  };
  const message = {
    from: getAddress(authorization.from),
    to: getAddress(authorization.to),
    value: BigInt(authorization.value),
    validAfter: BigInt(authorization.validAfter),
    validBefore: BigInt(authorization.validBefore),
    nonce: authorization.nonce as `0x${string}`,
  };

  const hash = hashTypedData({
    domain,
    types: EIP3009_TYPES,
    primaryType: "TransferWithAuthorization",
    message,
  });
  const recovered = await recoverAddress({
    hash,
    signature: signature as `0x${string}`,
  });
  if (recovered.toLowerCase() !== authorization.from.toLowerCase()) {
    return {
      success: false as const,
      error: `Signature mismatch: recovered ${recovered} != from ${authorization.from}`,
    };
  }
  console.log("[settle] Signature verified for", recovered);

  // Check balance
  const balance = await client.readContract({
    address: getAddress(USDC_ASSET),
    abi: USDC_ABI,
    functionName: "balanceOf",
    args: [getAddress(authorization.from)],
  });
  if (balance < BigInt(expectedAmount)) {
    return {
      success: false as const,
      error: `Insufficient USDC: has ${balance}, needs ${expectedAmount}`,
    };
  }
  console.log("[settle] Balance OK:", balance.toString());

  // Parse v, r, s from signature
  const sigHex = signature.startsWith("0x") ? signature.slice(2) : signature;
  const r = `0x${sigHex.slice(0, 64)}` as `0x${string}`;
  const s = `0x${sigHex.slice(64, 128)}` as `0x${string}`;
  const v = parseInt(sigHex.slice(128, 130), 16);

  console.log("[settle] Submitting transferWithAuthorization, v=", v);

  // Submit on-chain
  const txHash = await client.writeContract({
    address: getAddress(USDC_ASSET),
    abi: USDC_ABI,
    functionName: "transferWithAuthorization",
    args: [
      getAddress(authorization.from),
      getAddress(authorization.to),
      BigInt(authorization.value),
      BigInt(authorization.validAfter),
      BigInt(authorization.validBefore),
      authorization.nonce as `0x${string}`,
      v,
      r,
      s,
    ],
  });

  console.log("[settle] TX submitted:", txHash);
  const receipt = await client.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status !== "success") {
    return {
      success: false as const,
      error: "Transaction reverted on-chain",
      txHash,
    };
  }

  return { success: true as const, txHash, payer: authorization.from };
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

  // Payment header present — verify and settle directly
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

  const eip3009 = paymentPayload?.payload;
  if (!eip3009?.authorization || !eip3009?.signature) {
    return NextResponse.json(
      {
        error: "Invalid payment payload: missing authorization or signature",
      },
      { status: 400 },
    );
  }

  try {
    const result = await settlePayment(
      eip3009.authorization,
      eip3009.signature,
      amount,
      payTo,
    );

    if (!result.success) {
      console.error("[settle] Failed:", result.error);
      return NextResponse.json(
        { error: "Payment settlement failed", detail: result.error },
        { status: 402 },
      );
    }

    console.log("[settle] Success! TX:", result.txHash);

    // Forward buyer wallet and tx hash to Convex
    const headers = new Headers(request.headers);
    headers.delete("x-x402-verified");
    headers.set("x-buyer-wallet", result.payer ?? "");
    headers.set("x-payment-tx", result.txHash ?? "");

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
        result.payer ?? "",
        result.txHash ?? "",
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
