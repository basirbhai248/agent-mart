import assert from "node:assert/strict";
import test from "node:test";

import {
  fetchListing,
  getPlatformWalletAddress,
  listingIdFromPath,
  parseUsdPrice,
} from "./src/app/api/listings/[id]/content/payment.ts";
const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };

test("listing content helpers parse listing id from content path", () => {
  assert.equal(listingIdFromPath("/api/listings/abc/content"), "abc");
  assert.equal(listingIdFromPath("/api/listings/a%20b/content/"), "a b");
  assert.equal(listingIdFromPath("/api/listings/abc"), undefined);
});

test("listing content helpers parse usd price and fallback to minimum", () => {
  assert.equal(parseUsdPrice(1.5), 1.5);
  assert.equal(parseUsdPrice("$2.25"), 2.25);
  assert.equal(parseUsdPrice("nope"), 0.01);
  assert.equal(parseUsdPrice(0), 0.01);
});

test("listing content helpers require PLATFORM_WALLET_ADDRESS", () => {
  delete process.env.PLATFORM_WALLET_ADDRESS;
  assert.throws(
    () => getPlatformWalletAddress(),
    /PLATFORM_WALLET_ADDRESS is required/,
  );

  process.env.PLATFORM_WALLET_ADDRESS = " 0xabc ";
  assert.equal(getPlatformWalletAddress(), "0xabc");
});

test("fetchListing returns priceUsdc and forwards host header", async (t) => {
  process.env.CONVEX_SITE_URL = "https://example.convex.cloud";
  let calledUrl;
  let calledInit;

  globalThis.fetch = async (url, init) => {
    calledUrl = String(url);
    calledInit = init;
    return new Response(JSON.stringify({ priceUsdc: 3.75 }), { status: 200 });
  };

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const listing = await fetchListing(
    "listing_1",
    "https://localhost:3000/api/x",
  );
  assert.deepEqual(listing, { priceUsdc: 3.75 });
  assert.equal(
    calledUrl,
    "https://example.convex.cloud/api/listing?id=listing_1",
  );
  assert.equal(calledInit.method, "GET");
  assert.equal(calledInit.headers["x-forwarded-host"], "localhost:3000");
});

test("fetchListing returns null for invalid responses", async (t) => {
  process.env.CONVEX_SITE_URL = "https://example.convex.cloud";

  globalThis.fetch = async () =>
    new Response(JSON.stringify({ priceUsdc: 0 }), { status: 200 });

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const listing = await fetchListing(
    "listing_1",
    "https://localhost:3000/api/x",
  );
  assert.equal(listing, null);
});

test.after(() => {
  globalThis.fetch = originalFetch;
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) {
      delete process.env[key];
    }
  }
  Object.assign(process.env, originalEnv);
});
