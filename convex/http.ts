import { httpActionGeneric as httpAction, httpRouter } from "convex/server";
import { api } from "./_generated/api.js";
import type { Id } from "./_generated/dataModel.js";
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

  const existingCreator = await ctx.runQuery(api.queries.getCreatorByWallet, {
    wallet,
  });
  if (existingCreator) {
    return json({ error: "Creator already registered for wallet" }, 409);
  }

  const apiKey = crypto.randomUUID();
  const creatorId = await ctx.runMutation(api.mutations.createCreator, {
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

  const existingCreator = await ctx.runQuery(api.queries.getCreatorByWallet, {
    wallet,
  });
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
  await ctx.runMutation(api.mutations.updateCreatorApiKey, {
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

  const creator = await ctx.runQuery(api.queries.getCreatorByApiKey, {
    apiKey,
  });
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

  const listingId = await ctx.runMutation(api.mutations.createListing, {
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

  const listings = await ctx.runQuery(api.queries.getListings, {});
  return json(listings, 200);
});

export const homepageRoute = httpAction(async (ctx, request) => {
  if (request.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }

  const listings = await ctx.runQuery(api.queries.getListings, {});
  const featuredListings = listings
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 3);

  return html(renderHomepage(featuredListings), 200);
});

export const creatorProfilePageRoute = httpAction(async (ctx, request) => {
  if (request.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }

  const wallet = asNonEmptyString(
    new URL(request.url).searchParams.get("wallet"),
  );
  if (!wallet) {
    return json({ error: "Wallet is required" }, 400);
  }

  const creator = await ctx.runQuery(api.queries.getCreatorByWallet, {
    wallet,
  });
  if (!creator) {
    return html(renderCreatorNotFound(wallet), 404);
  }

  const listings = await ctx.runQuery(api.queries.getCreatorListings, {
    creatorId: creator._id,
  });

  return html(
    renderCreatorProfile({
      wallet: creator.wallet,
      displayName: creator.displayName,
      bio: creator.bio,
      twitterHandle: creator.twitterHandle,
      listings,
    }),
    200,
  );
});

export const searchListingsRoute = httpAction(async (ctx, request) => {
  if (request.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }

  const query = new URL(request.url).searchParams.get("q") ?? "";
  const listings = await ctx.runQuery(api.queries.searchListings, { query });
  return jsonWithContentLength(listings, 200);
});

export const searchPageRoute = httpAction(async (ctx, request) => {
  if (request.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }

  const query = new URL(request.url).searchParams.get("q") ?? "";
  const listings = await ctx.runQuery(api.queries.searchListings, { query });
  return html(renderSearchResultsPage(query, listings), 200);
});

export const getCreatorRoute = httpAction(async (ctx, request) => {
  if (request.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }

  const wallet = asNonEmptyString(
    new URL(request.url).searchParams.get("wallet"),
  );
  if (!wallet) {
    return json({ error: "Wallet is required" }, 400);
  }

  const creator = await ctx.runQuery(api.queries.getCreatorByWallet, {
    wallet,
  });
  if (!creator) {
    return json({ error: "Creator not found" }, 404);
  }

  const listings = await ctx.runQuery(api.queries.getCreatorListings, {
    creatorId: creator._id,
  });

  return json(
    {
      creator: {
        _id: creator._id,
        wallet: creator.wallet,
        displayName: creator.displayName,
        bio: creator.bio,
        twitterHandle: creator.twitterHandle ?? null,
        createdAt: creator.createdAt,
      },
      listings,
    },
    200,
  );
});

export const getMeRoute = httpAction(async (ctx, request) => {
  if (request.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }

  const apiKey = parseBearerToken(request.headers.get("authorization"));
  if (!apiKey) {
    return json({ error: "API key required" }, 401);
  }

  const creator = await ctx.runQuery(api.queries.getCreatorByApiKey, {
    apiKey,
  });
  if (!creator) {
    return json({ error: "Invalid API key" }, 401);
  }

  return json(
    {
      wallet: creator.wallet,
      displayName: creator.displayName,
    },
    200,
  );
});

export const getListingRoute = httpAction(async (ctx, request) => {
  if (request.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }

  const listingId = listingIdFromQuery(new URL(request.url).searchParams);
  if (!listingId) {
    return json({ error: "Listing id is required" }, 400);
  }

  const listing = await ctx.runQuery(api.queries.getListing, { listingId });
  if (!listing) {
    return json({ error: "Listing not found" }, 404);
  }

  return json(listing, 200);
});

export const getListingContentRoute = httpAction(async (ctx, request) => {
  if (request.method !== "GET") {
    return json({ error: "Method not allowed" }, 405);
  }

  const listingId = listingIdFromQuery(new URL(request.url).searchParams);
  if (!listingId) {
    return json({ error: "Listing id is required" }, 400);
  }

  const listing = await ctx.runQuery(api.queries.getListing, { listingId });
  if (!listing) {
    return json({ error: "Listing not found" }, 404);
  }

  if (request.headers.get("x-x402-verified") === "1") {
    return await listingContentJson(ctx, listing, "x402", false);
  }

  const buyerWallet = asNonEmptyString(request.headers.get("x-buyer-wallet"));
  if (buyerWallet) {
    const existingPurchase = await ctx.runQuery(
      api.queries.getPurchaseByListingAndBuyerWallet,
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
    await ctx.runMutation(api.mutations.recordPurchase, {
      listingId,
      buyerWallet,
      amountPaid: listing.priceUsdc,
      txHash,
    });

    return await listingContentJson(ctx, listing, buyerWallet, false);
  }

  return paymentRequiredResponse(request.url, listing.priceUsdc);
});

http.route({
  path: "/",
  method: "GET",
  handler: homepageRoute,
});

http.route({
  path: "/creator",
  method: "GET",
  handler: creatorProfilePageRoute,
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
  path: "/search",
  method: "GET",
  handler: searchPageRoute,
});

http.route({
  path: "/api/creators",
  method: "GET",
  handler: getCreatorRoute,
});

http.route({
  path: "/api/me",
  method: "GET",
  handler: getMeRoute,
});

http.route({
  path: "/api/listing",
  method: "GET",
  handler: getListingRoute,
});

http.route({
  path: "/api/listing/content",
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

function jsonWithContentLength(body: unknown, status: number): Response {
  const payload = JSON.stringify(body);
  return new Response(payload, {
    status,
    headers: {
      "content-type": "application/json",
      "content-length": String(new TextEncoder().encode(payload).byteLength),
    },
  });
}

function paymentRequiredResponse(url: string, priceUsdc: number): Response {
  const payTo =
    process.env.PLATFORM_WALLET_ADDRESS?.trim() ??
    process.env.PLATFORM_WALLET?.trim() ??
    "";
  const amount = Math.round(priceUsdc * 1_000_000).toString();
  const paymentRequirement = {
    scheme: "exact",
    network: "eip155:8453",
    amount,
    asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    payTo,
    maxTimeoutSeconds: 300,
    extra: {
      name: "USDC",
      version: 2,
    },
  };
  const paymentRequired = {
    x402Version: 2,
    error: "Payment required",
    resource: {
      url,
      description: "Access listing content",
      mimeType: "application/json",
    },
    accepts: [paymentRequirement],
  };
  const responseBody = {
    paymentRequirements: [
      {
        scheme: paymentRequirement.scheme,
        network: paymentRequirement.network,
        maxAmountRequired: paymentRequirement.amount,
        resource: url,
        description: "Access listing content",
        mimeType: "application/json",
        payTo: paymentRequirement.payTo,
        maxTimeoutSeconds: paymentRequirement.maxTimeoutSeconds,
        asset: paymentRequirement.asset,
        extra: {
          name: paymentRequirement.extra.name,
          version: String(paymentRequirement.extra.version),
        },
      },
    ],
    error: "X-PAYMENT-REQUIRED",
  };

  return new Response(JSON.stringify(responseBody), {
    status: 402,
    headers: {
      "content-type": "application/json",
      "payment-required": Buffer.from(JSON.stringify(paymentRequired)).toString(
        "base64",
      ),
    },
  });
}

function html(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
    },
  });
}

function renderHomepage(
  featuredListings: Array<{
    _id: string;
    title: string;
    description: string;
    priceUsdc: number;
  }>,
): string {
  const featuredMarkup =
    featuredListings.length === 0
      ? "<p>No featured listings yet.</p>"
      : `<ul>${featuredListings
          .map(
            (listing) =>
              `<li><article><h2>${escapeHtml(listing.title)}</h2><p>${escapeHtml(listing.description)}</p><p><strong>$${listing.priceUsdc.toFixed(2)} USDC</strong></p><a href="/api/listings/${encodeURIComponent(listing._id)}">View listing</a></article></li>`,
          )
          .join("")}</ul>`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Agent Mart</title>
    <style>
      :root { color-scheme: light; }
      body { font-family: "Segoe UI", Tahoma, sans-serif; margin: 0; background: linear-gradient(180deg, #f3f8ff 0%, #fff 45%); color: #112240; }
      main { max-width: 800px; margin: 0 auto; padding: 40px 20px 56px; }
      h1 { margin: 0 0 8px; font-size: clamp(2rem, 5vw, 2.6rem); }
      .lead { margin: 0 0 28px; color: #31435a; }
      ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 16px; }
      article { background: #fff; border: 1px solid #d7e4ff; border-radius: 12px; padding: 16px; box-shadow: 0 8px 24px rgba(26, 68, 116, 0.07); }
      h2 { margin: 0 0 8px; font-size: 1.25rem; }
      p { margin: 0 0 10px; line-height: 1.4; }
      a { color: #0050d2; font-weight: 600; text-decoration: none; }
      a:hover { text-decoration: underline; }
    </style>
  </head>
  <body>
    <main>
      <h1>Agent Mart</h1>
      <p class="lead">Featured listings from the creator marketplace.</p>
      ${featuredMarkup}
    </main>
  </body>
</html>`;
}

function renderCreatorProfile(creator: {
  wallet: string;
  displayName: string;
  bio: string;
  twitterHandle?: string;
  listings: Array<{
    _id: string;
    title: string;
    description: string;
    priceUsdc: number;
  }>;
}): string {
  const twitterMarkup = creator.twitterHandle
    ? `<p class="meta">Twitter: <a href="https://x.com/${encodeURIComponent(
        creator.twitterHandle.replace(/^@/, ""),
      )}">${escapeHtml(creator.twitterHandle)}</a></p>`
    : "";
  const listingsMarkup =
    creator.listings.length === 0
      ? "<p>This creator has no listings yet.</p>"
      : `<ul>${creator.listings
          .map(
            (listing) =>
              `<li><article><h2>${escapeHtml(listing.title)}</h2><p>${escapeHtml(listing.description)}</p><p><strong>$${listing.priceUsdc.toFixed(2)} USDC</strong></p><a href="/api/listings/${encodeURIComponent(listing._id)}">View listing</a></article></li>`,
          )
          .join("")}</ul>`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(creator.displayName)} | Agent Mart</title>
    <style>
      :root { color-scheme: light; }
      body { font-family: "Segoe UI", Tahoma, sans-serif; margin: 0; background: linear-gradient(160deg, #fff8ef 0%, #fff 52%, #eef7ff 100%); color: #18212f; }
      main { max-width: 860px; margin: 0 auto; padding: 40px 20px 56px; }
      .panel { background: rgba(255, 255, 255, 0.95); border: 1px solid #dfebff; border-radius: 14px; padding: 20px; box-shadow: 0 10px 28px rgba(19, 45, 80, 0.08); }
      h1 { margin: 0; font-size: clamp(2rem, 5vw, 2.4rem); }
      .wallet { margin: 6px 0 0; color: #435167; font-family: "SFMono-Regular", Consolas, monospace; font-size: 0.95rem; word-break: break-all; }
      .bio { margin: 12px 0 0; line-height: 1.5; }
      .meta { margin: 12px 0 0; color: #34465f; }
      h2 { margin: 30px 0 12px; font-size: 1.35rem; }
      ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 12px; }
      article { background: #fff; border: 1px solid #d8e7ff; border-radius: 12px; padding: 14px; }
      article h2 { margin: 0 0 6px; font-size: 1.15rem; }
      article p { margin: 0 0 8px; line-height: 1.4; }
      a { color: #0050d2; font-weight: 600; text-decoration: none; }
      a:hover { text-decoration: underline; }
    </style>
  </head>
  <body>
    <main>
      <section class="panel">
        <h1>${escapeHtml(creator.displayName)}</h1>
        <p class="wallet">${escapeHtml(creator.wallet)}</p>
        <p class="bio">${escapeHtml(creator.bio)}</p>
        ${twitterMarkup}
      </section>
      <h2>Listings</h2>
      ${listingsMarkup}
    </main>
  </body>
</html>`;
}

function renderCreatorNotFound(wallet: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Creator Not Found | Agent Mart</title>
  </head>
  <body>
    <main>
      <h1>Creator Not Found</h1>
      <p>No creator profile exists for wallet: ${escapeHtml(wallet)}</p>
    </main>
  </body>
</html>`;
}

function renderSearchResultsPage(
  query: string,
  listings: Array<{
    _id: string;
    title: string;
    description: string;
    priceUsdc: number;
  }>,
): string {
  const normalizedQuery = query.trim();
  const heading = normalizedQuery
    ? `Search results for "${escapeHtml(normalizedQuery)}"`
    : "Search listings";
  const summary = normalizedQuery
    ? `${listings.length} result${listings.length === 1 ? "" : "s"} found`
    : "Enter a keyword to search titles and descriptions.";

  let resultsMarkup = "";
  if (!normalizedQuery) {
    resultsMarkup =
      "<p>Try searching for terms like &quot;agent&quot; or &quot;guide&quot;.</p>";
  } else if (listings.length === 0) {
    resultsMarkup = "<p>No listings matched your search.</p>";
  } else {
    resultsMarkup = `<ul>${listings
      .map(
        (listing) =>
          `<li><article><h2>${escapeHtml(listing.title)}</h2><p>${escapeHtml(listing.description)}</p><p><strong>$${listing.priceUsdc.toFixed(2)} USDC</strong></p><a href="/api/listings/${encodeURIComponent(listing._id)}">View listing</a></article></li>`,
      )
      .join("")}</ul>`;
  }

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${normalizedQuery ? `${escapeHtml(normalizedQuery)} | ` : ""}Search | Agent Mart</title>
    <style>
      :root { color-scheme: light; }
      body { font-family: "Segoe UI", Tahoma, sans-serif; margin: 0; background: linear-gradient(180deg, #f5fff8 0%, #fff 50%, #eef6ff 100%); color: #1a2a3a; }
      main { max-width: 840px; margin: 0 auto; padding: 36px 20px 56px; }
      h1 { margin: 0 0 8px; font-size: clamp(1.8rem, 4vw, 2.4rem); }
      p { margin: 0 0 14px; line-height: 1.45; color: #324a61; }
      form { margin: 0 0 20px; display: flex; gap: 10px; }
      input[type="search"] { flex: 1; min-width: 0; padding: 10px 12px; border: 1px solid #bbcee6; border-radius: 10px; font: inherit; }
      button { border: 0; border-radius: 10px; padding: 10px 14px; background: #00654f; color: #fff; font: inherit; font-weight: 600; cursor: pointer; }
      ul { list-style: none; padding: 0; margin: 10px 0 0; display: grid; gap: 12px; }
      article { background: #fff; border: 1px solid #d7e4f7; border-radius: 12px; padding: 14px; }
      h2 { margin: 0 0 6px; font-size: 1.15rem; color: #18273a; }
      a { color: #0a4ecf; font-weight: 600; text-decoration: none; }
      a:hover { text-decoration: underline; }
      @media (max-width: 600px) {
        form { flex-direction: column; }
        button { width: 100%; }
      }
    </style>
  </head>
  <body>
    <main>
      <h1>${heading}</h1>
      <p>${summary}</p>
      <form method="GET" action="/search">
        <input type="search" name="q" value="${escapeHtml(query)}" placeholder="Search listings">
        <button type="submit">Search</button>
      </form>
      ${resultsMarkup}
    </main>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function listingIdFromQuery(
  searchParams: URLSearchParams,
): Id<"listings"> | undefined {
  const listingId = asNonEmptyString(searchParams.get("id"));
  return listingId as Id<"listings"> | undefined;
}

async function listingContentJson(
  ctx: {
    storage?: {
      getUrl?: (id: string) => Promise<string | null>;
      get?: (id: string) => Promise<Blob | null>;
    };
  },
  listing: { _id: string; fileStorageId: string },
  buyerWallet: string,
  hasPurchased: boolean,
): Promise<Response> {
  const contentUrl =
    typeof ctx.storage?.getUrl === "function"
      ? await ctx.storage.getUrl(listing.fileStorageId)
      : null;
  const content =
    !contentUrl && typeof ctx.storage?.get === "function"
      ? await readStoredContent(ctx.storage.get, listing.fileStorageId)
      : null;

  return json(
    {
      listingId: listing._id,
      buyerWallet,
      hasPurchased,
      fileStorageId: listing.fileStorageId,
      contentUrl,
      content,
    },
    200,
  );
}

async function readStoredContent(
  get: (id: string) => Promise<Blob | null>,
  fileStorageId: string,
): Promise<string | null> {
  const storedFile = await get(fileStorageId);
  if (!storedFile) {
    return null;
  }

  return await storedFile.text();
}
