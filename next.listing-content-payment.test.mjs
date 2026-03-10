import assert from "node:assert/strict";
import test from "node:test";
import { x402Client, x402HTTPClient } from "@x402/core/client";

import {
  buildPaymentRequiredHttpResponse,
  buildPaymentRequiredHeader,
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

test("buildPaymentRequiredHeader returns a parseable x402 PAYMENT-REQUIRED value", () => {
  const headerValue = buildPaymentRequiredHeader(
    "https://localhost:3000/api/listings/listing_1/content",
    3.75,
    "0xplatform",
  );
  const parser = new x402HTTPClient(new x402Client());
  const parsed = parser.getPaymentRequiredResponse((name) => {
    return name.toLowerCase() === "payment-required" ? headerValue : null;
  });
  assert.equal(parsed.x402Version, 2);
  assert.equal(parsed.accepts[0].scheme, "exact");
  assert.equal(parsed.accepts[0].network, "eip155:8453");
  assert.equal(parsed.accepts[0].amount, "3750000");
  assert.equal(parsed.accepts[0].payTo, "0xplatform");
  assert.equal(
    parsed.accepts[0].asset,
    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  );
});

test("buildPaymentRequiredHttpResponse matches middleware-style 402 response shape", () => {
  const response = buildPaymentRequiredHttpResponse(
    "https://localhost:3000/api/listings/listing_1/content",
    1.25,
    "0xplatform",
  );
  assert.equal(response.status, 402);
  assert.equal(response.headers["Content-Type"], "application/json");
  assert.ok(response.headers["PAYMENT-REQUIRED"]);

  const parser = new x402HTTPClient(new x402Client());
  const parsed = parser.getPaymentRequiredResponse((name) => {
    return name.toLowerCase() === "payment-required"
      ? response.headers["PAYMENT-REQUIRED"]
      : null;
  });
  assert.equal(parsed.error, "Payment required");
  assert.equal(parsed.accepts[0].amount, "1250000");
  assert.deepEqual(JSON.parse(response.body), {});
});

test("manual 402 HTTP response is parseable from fetch-style headers", () => {
  const built = buildPaymentRequiredHttpResponse(
    "https://localhost:3000/api/listings/listing_1/content",
    2.5,
    "0xplatform",
  );
  const httpResponse = new Response(built.body, {
    status: built.status,
    headers: built.headers,
  });

  const parser = new x402HTTPClient(new x402Client());
  const parsed = parser.getPaymentRequiredResponse((name) =>
    httpResponse.headers.get(name),
  );

  assert.equal(httpResponse.status, 402);
  assert.equal(httpResponse.headers.get("content-type"), "application/json");
  assert.equal(parsed.x402Version, 2);
  assert.equal(parsed.error, "Payment required");
  assert.equal(parsed.accepts[0].network, "eip155:8453");
  assert.equal(parsed.accepts[0].amount, "2500000");
  assert.equal(parsed.accepts[0].payTo, "0xplatform");
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
