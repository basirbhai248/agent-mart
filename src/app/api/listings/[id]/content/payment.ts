const listingContentPath = /^\/api\/listings\/([^/]+)\/content\/?$/i;

export type ListingResponse = { priceUsdc: number };
const DEFAULT_NETWORK = "eip155:84532";
const USDC_ASSET = "0x0000000000000000000000000000000000000000";

export function listingIdFromPath(pathname: string): string | undefined {
  const match = pathname.match(listingContentPath);
  if (!match) {
    return undefined;
  }

  const listingId = decodeURIComponent(match[1] ?? "").trim();
  return listingId.length > 0 ? listingId : undefined;
}

export async function fetchListing(
  listingId: string,
  requestUrl: string,
): Promise<ListingResponse | null> {
  const baseUrl = process.env.CONVEX_SITE_URL?.trim();
  if (!baseUrl) {
    return null;
  }

  const response = await fetch(
    new URL(
      `/api/listing?id=${encodeURIComponent(listingId)}`,
      baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`,
    ),
    {
      method: "GET",
      headers: { "x-forwarded-host": new URL(requestUrl).host },
    },
  );

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as { priceUsdc?: unknown } | null;
  if (
    !payload ||
    typeof payload.priceUsdc !== "number" ||
    !Number.isFinite(payload.priceUsdc) ||
    payload.priceUsdc <= 0
  ) {
    return null;
  }

  return { priceUsdc: payload.priceUsdc };
}

export function parseUsdPrice(price: unknown): number {
  if (typeof price === "number" && Number.isFinite(price) && price > 0) {
    return price;
  }
  if (typeof price === "string") {
    const normalized = price.trim().replace(/^\$/, "");
    const parsed = Number(normalized);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return 0.01;
}

export function getPlatformWalletAddress(): string {
  const payTo = process.env.PLATFORM_WALLET_ADDRESS?.trim();
  if (!payTo) {
    throw new Error("PLATFORM_WALLET_ADDRESS is required");
  }
  return payTo;
}

export function buildPaymentRequiredHeader(
  requestUrl: string,
  priceUsdc: number,
  payTo: string,
): string {
  const amount = Math.round(parseUsdPrice(priceUsdc) * 1_000_000).toString();
  const paymentRequired = {
    x402Version: 2,
    error: "Payment required",
    resource: {
      url: requestUrl,
      description: "Access listing content",
      mimeType: "application/json",
    },
    accepts: [
      {
        scheme: "exact",
        network: DEFAULT_NETWORK,
        amount,
        asset: USDC_ASSET,
        payTo,
        maxTimeoutSeconds: 300,
        extra: {
          name: "USDC",
          version: 2,
        },
      },
    ],
  };
  return Buffer.from(JSON.stringify(paymentRequired), "utf8").toString("base64");
}

export function buildPaymentRequiredHttpResponse(
  requestUrl: string,
  priceUsdc: number,
  payTo: string,
): { body: string; headers: Record<string, string>; status: number } {
  return {
    body: JSON.stringify({}),
    status: 402,
    headers: {
      "Content-Type": "application/json",
      "PAYMENT-REQUIRED": buildPaymentRequiredHeader(requestUrl, priceUsdc, payTo),
    },
  };
}
