import { HTTPFacilitatorClient } from "@x402/core/server";
import { withX402 as paymentMiddleware, x402ResourceServer } from "@x402/next";
import { NextRequest, NextResponse } from "next/server";

import { proxyToConvex } from "../../../_lib/proxy";
import {
  fetchListing,
  getPlatformWalletAddress,
  listingIdFromPath,
  parseUsdPrice,
} from "./payment";

const X402_NETWORK = "eip155:84532";
const X402_SCHEME = "exact";
const X402_ASSET = "0x0000000000000000000000000000000000000000";
const X402_FACILITATOR_URL = "https://x402.org/facilitator";

const exactUsdcScheme: any = {
  scheme: X402_SCHEME,
  async parsePrice(price: unknown) {
    const usd = parseUsdPrice(price);
    return {
      amount: Math.round(usd * 1_000_000).toString(),
      asset: X402_ASSET,
      extra: {
        name: "USDC",
        version: 2,
      },
    };
  },
  async enhancePaymentRequirements(
    paymentRequirements: any,
    supportedKind: any,
  ) {
    return {
      ...paymentRequirements,
      extra: {
        ...supportedKind.extra,
        ...(paymentRequirements.extra as Record<string, unknown>),
      },
    };
  },
};

const resourceServer = new x402ResourceServer(
  new HTTPFacilitatorClient({
    url: process.env.X402_FACILITATOR_URL ?? X402_FACILITATOR_URL,
  }),
).register(
  (process.env.X402_NETWORK?.trim() || X402_NETWORK) as `${string}:${string}`,
  exactUsdcScheme,
);

const routeConfig = {
  accepts: {
    scheme: X402_SCHEME,
    network: (process.env.X402_NETWORK?.trim() || X402_NETWORK) as `${string}:${string}`,
    payTo: async () => getPlatformWalletAddress(),
    price: async (context) => {
      const listingId = listingIdFromPath(context.path);
      if (!listingId) {
        return "$0.01";
      }
      const listing = await fetchListing(listingId, context.adapter.getUrl());
      return listing ? `$${listing.priceUsdc}` : "$0.01";
    },
  },
  description: "Access listing content",
  unpaidResponseBody: () => ({
    contentType: "application/json",
    body: { error: "Payment required" },
  }),
};

async function getListingContent(request: NextRequest): Promise<NextResponse> {
  const listingId = listingIdFromPath(request.nextUrl.pathname);
  if (!listingId) {
    return NextResponse.json({ error: "Listing id is required" }, { status: 400 });
  }

  const headers = new Headers(request.headers);
  headers.set("x-x402-verified", "1");
  headers.delete("payment-signature");
  headers.delete("x-payment");

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

export const GET = paymentMiddleware(
  getListingContent,
  routeConfig,
  resourceServer,
  undefined,
  undefined,
  false,
);
