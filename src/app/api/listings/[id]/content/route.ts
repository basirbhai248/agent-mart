import { NextRequest, NextResponse } from "next/server";

import { proxyToConvex } from "../../../_lib/proxy";
import { listingIdFromPath } from "./payment";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const listingId = listingIdFromPath(request.nextUrl.pathname);
  if (!listingId) {
    return NextResponse.json({ error: "Listing id is required" }, { status: 400 });
  }

  // Check for X402 payment headers
  const paymentSignature = request.headers.get("payment-signature");
  const xPayment = request.headers.get("x-payment");

  if (!paymentSignature || !xPayment) {
    // Return 402 Payment Required with X402-compliant format
    return NextResponse.json(
      {
        error: "Payment required",
        payment: {
          scheme: "x402",
          network: "base",
          currency: "USDC",
          amountUsdc: 0.5,
          destinationWallet: "0x0000000000000000000000000000000000000000",
        },
      },
      {
        status: 402,
        headers: {
          "WWW-Authenticate": 'x402 scheme="x402" network="base" currency="USDC"',
        },
      },
    );
  }

  // If payment headers present, proxy to Convex
  const headers = new Headers(request.headers);
  headers.set("x-x402-verified", "1");

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
