import { NextResponse } from "next/server";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { createFacilitatorConfig } from "@coinbase/x402";

import { proxyToConvex } from "../_lib/proxy";
import {
  buildPaymentRequiredHeader,
  getPlatformWalletAddress,
} from "../listings/[id]/content/payment";

const DEFAULT_NETWORK = "eip155:8453" as const;
const USDC_ASSET = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const CREATOR_FEE_USDC = 0.001; // testing price

let _facilitator: HTTPFacilitatorClient | null = null;
function getFacilitator(): HTTPFacilitatorClient {
  if (!_facilitator) {
    _facilitator = new HTTPFacilitatorClient(createFacilitatorConfig());
    console.log("[register] Using CDP facilitator for settlement");
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

export async function POST(request: Request): Promise<NextResponse> {
  const paymentHeader = getPaymentHeader(request);

  if (!paymentHeader) {
    // No payment — return 402 with creator fee
    const payTo = getPlatformWalletAddress();
    const headerValue = buildPaymentRequiredHeader(
      request.url,
      CREATOR_FEE_USDC,
      payTo,
    );
    return new NextResponse(JSON.stringify({}), {
      status: 402,
      headers: {
        "Content-Type": "application/json",
        "PAYMENT-REQUIRED": headerValue,
      },
    });
  }

  // Payment header present — verify and settle via CDP facilitator
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
  const amount = Math.round(CREATOR_FEE_USDC * 1_000_000).toString();

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
    const settleResult = await facilitator.settle(
      paymentPayload,
      paymentRequirements,
    );

    if (!settleResult.success) {
      console.error(
        "[register] Facilitator failed:",
        settleResult.errorReason,
        settleResult.errorMessage,
      );
      return NextResponse.json(
        {
          error: "Payment settlement failed",
          detail: settleResult.errorMessage ?? settleResult.errorReason,
        },
        { status: 402 },
      );
    }

    console.log(
      "[register] CDP facilitator settled! TX:",
      settleResult.transaction,
      "payer:",
      settleResult.payer,
    );

    // Payment verified — proxy to Convex with verification headers
    const headers = new Headers(request.headers);
    headers.delete("x-x402-verified");
    headers.set("x-creator-fee-paid", "true");
    headers.set("x-payment-tx", settleResult.transaction ?? "");

    const response = await proxyToConvex(
      new Request(request.url, {
        method: request.method,
        headers,
        body: await request.arrayBuffer(),
      }),
      "/api/register",
    );

    return new NextResponse(await response.arrayBuffer(), {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("[register] Exception:", errMsg);
    return NextResponse.json(
      { error: "Payment settlement exception", detail: errMsg },
      { status: 402 },
    );
  }
}
