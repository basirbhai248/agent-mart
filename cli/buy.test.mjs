import assert from "node:assert/strict";
import test from "node:test";

import { buyListing, createBuyAction } from "./bin/buy.js";

class FakeExactEvmScheme {
  constructor(account) {
    this.account = account;
  }
}

class FakeExactEvmSchemeV1 {
  constructor(account) {
    this.account = account;
  }
}

class FakeX402Client {
  constructor() {
    this.registerCalls = [];
    this.registerV1Calls = [];
  }

  register(network, scheme) {
    this.registerCalls.push({ network, scheme });
    return this;
  }

  registerV1(network, scheme) {
    this.registerV1Calls.push({ network, scheme });
    return this;
  }
}

test("buyListing calls paid GET Vercel proxy /api/listings/<id>/content and writes downloaded content", async () => {
  const calls = {
    privateKeyToAccount: [],
    wrapFetchWithPayment: [],
    paidFetch: [],
    rawFetch: [],
    writes: [],
    recordedPurchases: [],
  };

  const result = await buyListing(
    " listing_1 ",
    { apiUrl: "https://override.example" },
    {
      resolvePrivateKey: async () => "0xprivate",
      privateKeyToAccount: (privateKey) => {
        calls.privateKeyToAccount.push(privateKey);
        return { address: "0xabc", privateKey };
      },
      fetchImpl: async (url, init) => {
        calls.rawFetch.push({ url: String(url), init });
        return new Response("paid content", { status: 200 });
      },
      wrapFetchWithPayment: (fetchImpl, options) => {
        calls.wrapFetchWithPayment.push({ fetchImpl, options });
        return async (url, init) => {
          calls.paidFetch.push({ url: String(url), init });
          return new Response(
            JSON.stringify({ contentUrl: "https://download.agentmart.dev/file_1" }),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            },
          );
        };
      },
      x402ClientCtor: FakeX402Client,
      exactEvmSchemeCtor: FakeExactEvmScheme,
      exactEvmSchemeV1Ctor: FakeExactEvmSchemeV1,
      fsModule: {
        writeFile: async (filePath, content, encoding) => {
          calls.writes.push({ filePath, content, encoding });
        },
      },
      recordPurchasedContent: async (purchase) => {
        calls.recordedPurchases.push(purchase);
      },
    },
  );

  assert.equal(result.outputPath, "listing_1.txt");
  assert.deepEqual(calls.privateKeyToAccount, ["0xprivate"]);
  assert.equal(calls.wrapFetchWithPayment.length, 1);
  assert.equal(calls.wrapFetchWithPayment[0].options instanceof FakeX402Client, true);
  assert.deepEqual(
    calls.wrapFetchWithPayment[0].options.registerCalls.map(({ network }) => network),
    ["base", "eip155:8453", "eip155:*"],
  );
  assert.deepEqual(
    calls.wrapFetchWithPayment[0].options.registerV1Calls.map(({ network }) => network),
    ["base"],
  );
  assert.equal(calls.paidFetch.length, 1);
  assert.equal(
    calls.paidFetch[0].url,
    "https://override.example/api/listings/listing_1/content",
  );
  assert.equal(calls.paidFetch[0].init.method, "GET");
  assert.equal(calls.rawFetch.length, 1);
  assert.equal(calls.rawFetch[0].url, "https://download.agentmart.dev/file_1");
  assert.equal(calls.rawFetch[0].init.method, "GET");
  assert.deepEqual(calls.writes, [
    { filePath: "listing_1.txt", content: "paid content", encoding: "utf8" },
  ]);
  assert.deepEqual(calls.recordedPurchases, [
    {
      listingId: "listing_1",
      outputPath: "listing_1.txt",
      content: "paid content",
    },
  ]);
});

test("buyListing supports inline content and --output override", async () => {
  const writes = [];

  const result = await buyListing(
    "listing_2",
    { output: " ./content.md " },
    {
      resolvePrivateKey: async () => "0xprivate",
      privateKeyToAccount: () => ({ address: "0xabc" }),
      fetchImpl: async () => {
        throw new Error("raw fetch should not be used when content is inline");
      },
      wrapFetchWithPayment: () => {
        return async () =>
          new Response(JSON.stringify({ content: "inline content" }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
      },
      x402ClientCtor: FakeX402Client,
      exactEvmSchemeCtor: FakeExactEvmScheme,
      exactEvmSchemeV1Ctor: FakeExactEvmSchemeV1,
      fsModule: {
        writeFile: async (filePath, content, encoding) => {
          writes.push({ filePath, content, encoding });
        },
      },
      recordPurchasedContent: async () => {},
    },
  );

  assert.equal(result.outputPath, "./content.md");
  assert.deepEqual(writes, [
    { filePath: "./content.md", content: "inline content", encoding: "utf8" },
  ]);
});

test("buyListing uses Base Sepolia network when --testnet is enabled", async () => {
  const calls = [];

  await buyListing(
    "listing_3",
    { testnet: true },
    {
      resolvePrivateKey: async () => "0xprivate",
      privateKeyToAccount: () => ({ address: "0xabc" }),
      fetchImpl: async () => new Response("downloaded content", { status: 200 }),
      wrapFetchWithPayment: (_fetchImpl, options) => {
        calls.push(options);
        return async () =>
          new Response(
            JSON.stringify({ contentUrl: "https://download.agentmart.dev/file_3" }),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            },
          );
      },
      x402ClientCtor: FakeX402Client,
      exactEvmSchemeCtor: FakeExactEvmScheme,
      exactEvmSchemeV1Ctor: FakeExactEvmSchemeV1,
      fsModule: { writeFile: async () => {} },
      recordPurchasedContent: async () => {},
    },
  );

  assert.equal(calls.length, 1);
  assert.deepEqual(
    calls[0].registerCalls.map(({ network }) => network),
    ["base-sepolia", "eip155:84532", "eip155:*"],
  );
  assert.deepEqual(
    calls[0].registerV1Calls.map(({ network }) => network),
    ["base-sepolia"],
  );
});

test("buyListing uses Base Sepolia when AGENTMART_TESTNET=true", async () => {
  const calls = [];

  await buyListing(
    "listing_3",
    {},
    {
      env: { AGENTMART_TESTNET: "true" },
      resolvePrivateKey: async () => "0xprivate",
      privateKeyToAccount: () => ({ address: "0xabc" }),
      fetchImpl: async () => new Response("downloaded content", { status: 200 }),
      wrapFetchWithPayment: (_fetchImpl, options) => {
        calls.push(options);
        return async () =>
          new Response(
            JSON.stringify({ contentUrl: "https://download.agentmart.dev/file_3" }),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            },
          );
      },
      x402ClientCtor: FakeX402Client,
      exactEvmSchemeCtor: FakeExactEvmScheme,
      exactEvmSchemeV1Ctor: FakeExactEvmSchemeV1,
      fsModule: { writeFile: async () => {} },
      recordPurchasedContent: async () => {},
    },
  );

  assert.equal(calls.length, 1);
  assert.deepEqual(
    calls[0].registerCalls.map(({ network }) => network),
    ["base-sepolia", "eip155:84532", "eip155:*"],
  );
  assert.deepEqual(
    calls[0].registerV1Calls.map(({ network }) => network),
    ["base-sepolia"],
  );
});

test("buyListing validates required inputs and private key", async () => {
  await assert.rejects(buyListing("   "), /<listing-id> is required/);

  await assert.rejects(
    buyListing("listing_1", {}, { resolvePrivateKey: async () => undefined }),
    /Missing private key/,
  );
});

test("buyListing surfaces API and download errors", async () => {
  await assert.rejects(
    buyListing("listing_1", {}, {
      resolvePrivateKey: async () => "0xprivate",
      privateKeyToAccount: () => ({ address: "0xabc" }),
      fetchImpl: async () => {},
      wrapFetchWithPayment: () => {
        return async () =>
          new Response(JSON.stringify({ error: "Payment required" }), {
            status: 402,
            headers: { "content-type": "application/json" },
          });
      },
      x402ClientCtor: FakeX402Client,
      exactEvmSchemeCtor: FakeExactEvmScheme,
      exactEvmSchemeV1Ctor: FakeExactEvmSchemeV1,
    }),
    /Buy failed \(402\): Payment required/,
  );

  await assert.rejects(
    buyListing("listing_1", {}, {
      resolvePrivateKey: async () => "0xprivate",
      privateKeyToAccount: () => ({ address: "0xabc" }),
      fetchImpl: async () => new Response("missing", { status: 404 }),
      wrapFetchWithPayment: () => {
        return async () =>
          new Response(
            JSON.stringify({ contentUrl: "https://download.agentmart.dev/file_missing" }),
            {
              status: 200,
              headers: { "content-type": "application/json" },
            },
          );
      },
      x402ClientCtor: FakeX402Client,
      exactEvmSchemeCtor: FakeExactEvmScheme,
      exactEvmSchemeV1Ctor: FakeExactEvmSchemeV1,
    }),
    /Failed to download content \(404\)/,
  );
});

test("buyListing surfaces paid fetch parse failures as payment errors", async () => {
  await assert.rejects(
    buyListing("listing_1", {}, {
      resolvePrivateKey: async () => "0xprivate",
      privateKeyToAccount: () => ({ address: "0xabc" }),
      fetchImpl: async () => {},
      wrapFetchWithPayment: () => {
        return async () => {
          throw new Error("Unable to parse payment requirements");
        };
      },
      x402ClientCtor: FakeX402Client,
      exactEvmSchemeCtor: FakeExactEvmScheme,
      exactEvmSchemeV1Ctor: FakeExactEvmSchemeV1,
    }),
    (error) => {
      assert.equal(error instanceof Error, true);
      assert.match(error.message, /^Payment error:/);
      assert.doesNotMatch(error.message, /parse/i);
      return true;
    },
  );
});

test("createBuyAction logs saved path", async () => {
  const logs = [];
  const action = createBuyAction({
    logger: { log: (line) => logs.push(line) },
    resolvePrivateKey: async () => "0xprivate",
    privateKeyToAccount: () => ({ address: "0xabc" }),
    fetchImpl: async () => new Response("file body", { status: 200 }),
    wrapFetchWithPayment: () => {
      return async () =>
        new Response(
          JSON.stringify({ contentUrl: "https://download.agentmart.dev/file_2" }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
    },
    x402ClientCtor: FakeX402Client,
    exactEvmSchemeCtor: FakeExactEvmScheme,
    exactEvmSchemeV1Ctor: FakeExactEvmSchemeV1,
    fsModule: { writeFile: async () => {} },
    recordPurchasedContent: async () => {},
  });

  await action("listing_2", {});
  assert.deepEqual(logs, ["Saved content to listing_2.txt"]);
});
