import assert from "node:assert/strict";
import test from "node:test";

import { proxyToConvex } from "./src/app/api/_lib/proxy.ts";

const originalFetch = globalThis.fetch;

test("proxyToConvex forwards POST requests to Convex with body and headers", async (t) => {
  process.env.NEXT_PUBLIC_CONVEX_URL = "https://example.convex.cloud/";

  let calledUrl;
  let calledInit;

  globalThis.fetch = async (url, init) => {
    calledUrl = String(url);
    calledInit = init;
    return new Response(JSON.stringify({ ok: true }), {
      status: 201,
      headers: { "content-type": "application/json" },
    });
  };

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const request = new Request("https://localhost:3000/api/register", {
    method: "POST",
    headers: {
      authorization: "Bearer key_123",
      "content-type": "application/json",
      host: "localhost:3000",
    },
    body: JSON.stringify({ wallet: "0xabc" }),
  });

  const response = await proxyToConvex(request, "/api/register");

  assert.equal(response.status, 201);
  assert.equal(calledUrl, "https://example.convex.cloud/api/register");
  assert.equal(calledInit.method, "POST");
  assert.equal(calledInit.redirect, "manual");
  assert.equal(calledInit.headers.get("authorization"), "Bearer key_123");
  assert.equal(calledInit.headers.get("host"), null);

  const bodyText = new TextDecoder().decode(calledInit.body);
  assert.equal(bodyText, JSON.stringify({ wallet: "0xabc" }));
});

test("proxyToConvex forwards GET query params to Convex", async (t) => {
  process.env.NEXT_PUBLIC_CONVEX_URL = "https://example.convex.cloud";

  let calledUrl;

  globalThis.fetch = async (url) => {
    calledUrl = String(url);
    return new Response("[]", {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const request = new Request("https://localhost:3000/api/search?q=alpha");
  const response = await proxyToConvex(request, "/api/search");

  assert.equal(response.status, 200);
  assert.equal(calledUrl, "https://example.convex.cloud/api/search?q=alpha");
});

test("proxyToConvex preserves 402 responses for listing content", async (t) => {
  process.env.NEXT_PUBLIC_CONVEX_URL = "https://example.convex.cloud";

  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        error: "Payment required",
        payment: { scheme: "x402", amountUsdc: 5 },
      }),
      {
        status: 402,
        headers: { "content-type": "application/json" },
      },
    );

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const request = new Request(
    "https://localhost:3000/api/listings/listing_1/content",
  );
  const response = await proxyToConvex(
    request,
    "/api/listings/listing_1/content",
  );

  assert.equal(response.status, 402);
  const payload = await response.json();
  assert.equal(payload.payment.scheme, "x402");
});

test("proxyToConvex throws when NEXT_PUBLIC_CONVEX_URL is missing", async (t) => {
  delete process.env.NEXT_PUBLIC_CONVEX_URL;

  globalThis.fetch = async () => {
    throw new Error("fetch should not be called");
  };

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const request = new Request("https://localhost:3000/api/listings");

  await assert.rejects(
    proxyToConvex(request, "/api/listings"),
    /NEXT_PUBLIC_CONVEX_URL is required/,
  );
});
