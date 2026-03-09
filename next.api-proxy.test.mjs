import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { proxyToConvex } from "./src/app/api/_lib/proxy.ts";

const originalFetch = globalThis.fetch;

test("proxyToConvex forwards POST requests to Convex with body and headers", async (t) => {
  process.env.CONVEX_SITE_URL = "https://example.convex.cloud/";

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
  process.env.CONVEX_SITE_URL = "https://example.convex.cloud";

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

test("proxyToConvex merges path and request query params", async (t) => {
  process.env.CONVEX_SITE_URL = "https://example.convex.cloud";

  let calledUrl;

  globalThis.fetch = async (url) => {
    calledUrl = String(url);
    return new Response("{}", {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const request = new Request(
    "https://localhost:3000/api/listings/listing_1?include=meta",
  );
  const response = await proxyToConvex(request, "/api/listing?id=listing_1");

  assert.equal(response.status, 200);
  assert.equal(
    calledUrl,
    "https://example.convex.cloud/api/listing?id=listing_1&include=meta",
  );
});

test("listing and creator route handlers target Convex query-param endpoints", async () => {
  const [listingRoute, listingContentRoute, creatorRoute, creatorsRoute] =
    await Promise.all([
      readFile("./src/app/api/listings/[id]/route.ts", "utf8"),
      readFile("./src/app/api/listings/[id]/content/route.ts", "utf8"),
      readFile("./src/app/api/creators/[wallet]/route.ts", "utf8"),
      readFile("./src/app/api/creators/route.ts", "utf8"),
    ]);

  assert.match(
    listingRoute,
    /\/api\/listing\?id=\$\{encodeURIComponent\(id\)\}/,
  );
  assert.match(
    listingContentRoute,
    /\/api\/listing\/content\?id=\$\{encodeURIComponent\(id\)\}/,
  );
  assert.match(
    creatorRoute,
    /\/api\/creators\?wallet=\$\{encodeURIComponent\(wallet\)\}/,
  );
  assert.match(creatorsRoute, /proxyToConvex\(request, "\/api\/creators"\)/);
});

test("proxyToConvex preserves 402 responses for listing content", async (t) => {
  process.env.CONVEX_SITE_URL = "https://example.convex.cloud";

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

test("proxyToConvex throws when CONVEX_SITE_URL is missing", async (t) => {
  delete process.env.CONVEX_SITE_URL;

  globalThis.fetch = async () => {
    throw new Error("fetch should not be called");
  };

  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const request = new Request("https://localhost:3000/api/listings");

  await assert.rejects(
    proxyToConvex(request, "/api/listings"),
    /CONVEX_SITE_URL is required/,
  );
});
