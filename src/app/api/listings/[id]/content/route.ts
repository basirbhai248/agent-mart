import { NextResponse } from "next/server";

import { proxyToConvex } from "../../../_lib/proxy";
import {
  buildPaymentRequiredHttpResponse,
  fetchListing,
  getPlatformWalletAddress,
  listingIdFromPath,
} from "./payment";

export async function GET(request: Request): Promise<NextResponse> {
  const listingId = listingIdFromPath(new URL(request.url).pathname);
  if (!listingId) {
    return NextResponse.json({ error: "Listing id is required" }, { status: 400 });
  }

  const paymentSignature = request.headers.get("payment-signature");
  const xPayment = request.headers.get("x-payment");
  const hasPayment = Boolean(paymentSignature || xPayment);

  if (!hasPayment) {
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
