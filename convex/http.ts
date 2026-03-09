import { httpActionGeneric as httpAction, httpRouter } from "convex/server";

import {
  createCreator,
  createListing,
  recordPurchase,
  updateCreatorApiKey,
} from "./mutations.ts";
import {
  getCreatorByApiKey,
  getCreatorByWallet,
  getListing,
  getListings,
  getPurchaseByListingAndBuyerWallet,
  searchListings,
} from "./queries.ts";
import { buildRecoveryMessage, recoverWalletAddress } from "./wallet.ts";

const http = httpRouter();

export const registerCreator = httpAction(async (ctx, request) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const wallet = asNonEmptyString(payload?.wallet);
  const displayName = asNonEmptyString(payload?.displayName ?? payload?.name);
  const bio = asNonEmptyString(payload?.bio);
  const twitterHandle = asOptionalNonEmptyString(payload?.twitterHandle);

  if (!wallet || !displayName || !bio) {
    return json({ error: "wallet, displayName, and bio are required" }, 400);
  }

  const existingCreator = await ctx.runQuery(getCreatorByWallet, { wallet });
  if (existingCreator) {
    return json({ error: "Creator already registered for wallet" }, 409);
  }

  const apiKey = crypto.randomUUID();
  const creatorId = await ctx.runMutation(createCreator, {
    wallet,
    displayName,
    bio,
    twitterHandle,
    apiKey,
  });

  return json({ creatorId, apiKey }, 201);
});

export const recoverCreator = httpAction(async (ctx, request) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const wallet = asNonEmptyString(payload?.wallet);
  const signature = asNonEmptyString(payload?.signature);
  const message =
    asNonEmptyString(payload?.message) ??
    (wallet ? buildRecoveryMessage(wallet) : undefined);

  if (!wallet || !signature || !message) {
    return json({ error: "wallet and signature are required" }, 400);
  }

  const existingCreator = await ctx.runQuery(getCreatorByWallet, { wallet });
  if (!existingCreator) {
    return json({ error: "Creator not found for wallet" }, 404);
  }

  const recoveredWallet = recoverWalletAddress(message, signature);
  if (
    !recoveredWallet ||
    recoveredWallet.toLowerCase() !== wallet.toLowerCase()
  ) {
    return json({ error: "Invalid wallet signature" }, 401);
  }

  const apiKey = crypto.randomUUID();
  await ctx.runMutation(updateCreatorApiKey, {
    creatorId: existingCreator._id,
    apiKey,
  });

  return json({ creatorId: existingCreator._id, apiKey }, 200);
});

export const createListingRoute = httpAction(async (ctx, request) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const apiKey = parseBearerToken(request.headers.get("authorization"));
  if (!apiKey) {
    return json({ error: "API key required" }, 401);
  }

  const creator = await ctx.runQuery(getCreatorByApiKey, { apiKey });
  if (!creator) {
    return json({ error: "Invalid API key" }, 401);
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const title = asNonEmptyString(payload?.title);
  const description = asNonEmptyString(payload?.description);
  const fileStorageId = asNonEmptyString(payload?.fileStorageId);
  const priceUsdc =
    typeof payload?.priceUsdc === "number" &&
    Number.isFinite(payload.priceUsdc) &&
    payload.priceUsdc > 0
      ? payload.priceUsdc
      : undefined;

  if (!title || !description || !fileStorageId || priceUsdc === undefined) {
    return json(
      {
        error: "title, description, priceUsdc, and fileStorageId are required",
      },
      400,
    );
  }

  const listingId = await ctx.runMutation(createListing, {
    creatorId: creator._id,
    title,
    description,
    priceUsdc,
    fileStorageId,
  });

  return json({ listingId }, 201);
});

export const listListingsRoute = httpAction(async (ctx, request) => {
  if (request.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }

  const listings = await ctx.runQuery(getListings, {});
  return json(listings, 200);
});

export const searchListingsRoute = httpAction(async (ctx, request) => {
  if (request.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }

  const query = new URL(request.url).searchParams.get("q") ?? "";
  const listings = await ctx.runQuery(searchListings, { query });
  return json(listings, 200);
});

export const getListingRoute = httpAction(async (ctx, request) => {
  if (request.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }

  const listingId = listingIdFromPathname(new URL(request.url).pathname);
  if (!listingId) {
    return json({ error: "Listing id is required" }, 400);
  }

  const listing = await ctx.runQuery(getListing, { listingId });
  if (!listing) {
    return json({ error: "Listing not found" }, 404);
  }

  return json(listing, 200);
});

export const getListingContentRoute = httpAction(async (ctx, request) => {
  if (request.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }

  const listingId = listingContentIdFromPathname(new URL(request.url).pathname);
  if (!listingId) {
    return json({ error: "Listing id is required" }, 400);
  }

  const listing = await ctx.runQuery(getListing, { listingId });
  if (!listing) {
    return json({ error: "Listing not found" }, 404);
  }

  const buyerWallet = asNonEmptyString(request.headers.get("x-buyer-wallet"));
  if (buyerWallet) {
    const existingPurchase = await ctx.runQuery(
      getPurchaseByListingAndBuyerWallet,
      {
        listingId,
        buyerWallet,
      },
    );
    if (existingPurchase) {
      return await listingContentJson(ctx, listing, buyerWallet, true);
    }
  }

  const txHash = asNonEmptyString(request.headers.get("x-payment-tx"));
  if (buyerWallet && txHash) {
    await ctx.runMutation(recordPurchase, {
      listingId,
      buyerWallet,
      amountPaid: listing.priceUsdc,
      txHash,
    });

    return await listingContentJson(ctx, listing, buyerWallet, false);
  }

  return json(
    {
      error: "Payment required",
      payment: {
        scheme: "x402",
        network: "base",
        currency: "USDC",
        amountUsdc: listing.priceUsdc,
        destinationWallet: process.env.PLATFORM_WALLET ?? null,
      },
    },
    402,
  );
});

http.route({
  path: "/api/register",
  method: "POST",
  handler: registerCreator,
});

http.route({
  path: "/api/recover",
  method: "POST",
  handler: recoverCreator,
});

http.route({
  path: "/api/listings",
  method: "POST",
  handler: createListingRoute,
});

http.route({
  path: "/api/listings",
  method: "GET",
  handler: listListingsRoute,
});

http.route({
  path: "/api/search",
  method: "GET",
  handler: searchListingsRoute,
});

http.route({
  path: "/api/listings/:id",
  method: "GET",
  handler: getListingRoute,
});

http.route({
  path: "/api/listings/:id/content",
  method: "GET",
  handler: getListingContentRoute,
});

export default http;

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function asOptionalNonEmptyString(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  return asNonEmptyString(value);
}

function parseBearerToken(value: string | null): string | undefined {
  const trimmed = asNonEmptyString(value);
  if (!trimmed) {
    return undefined;
  }

  const [scheme, token, extra] = trimmed.split(/\s+/);
  if (extra || scheme.toLowerCase() !== "bearer") {
    return undefined;
  }

  return asNonEmptyString(token);
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

function listingIdFromPathname(pathname: string): string | undefined {
  const segments = pathname.split("/").filter(Boolean);
  if (
    segments.length !== 3 ||
    segments[0] !== "api" ||
    segments[1] !== "listings"
  ) {
    return undefined;
  }

  try {
    return asNonEmptyString(decodeURIComponent(segments[2]));
  } catch {
    return undefined;
  }
}

function listingContentIdFromPathname(pathname: string): string | undefined {
  const segments = pathname.split("/").filter(Boolean);
  if (
    segments.length !== 4 ||
    segments[0] !== "api" ||
    segments[1] !== "listings" ||
    segments[3] !== "content"
  ) {
    return undefined;
  }

  try {
    return asNonEmptyString(decodeURIComponent(segments[2]));
  } catch {
    return undefined;
  }
}

async function listingContentJson(
  ctx: { storage?: { getUrl?: (id: string) => Promise<string | null> } },
  listing: { _id: string; fileStorageId: string },
  buyerWallet: string,
  hasPurchased: boolean,
): Promise<Response> {
  const contentUrl =
    typeof ctx.storage?.getUrl === "function"
      ? await ctx.storage.getUrl(listing.fileStorageId)
      : null;

  return json(
    {
      listingId: listing._id,
      buyerWallet,
      hasPurchased,
      fileStorageId: listing.fileStorageId,
      contentUrl,
    },
    200,
  );
}
