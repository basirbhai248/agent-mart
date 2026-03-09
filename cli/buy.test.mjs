import assert from "node:assert/strict";
import test from "node:test";

import { buyListing, createBuyAction } from "./bin/buy.js";

test("buyListing calls paid GET /api/listings/<id>/content and writes downloaded content", async () => {
  const calls = {
    privateKeyToAccount: [],
    wrapFetchWithPayment: [],
    paidFetch: [],
    rawFetch: [],
    writes: [],
  };

  const result = await buyListing(
    " listing_1 ",
    { apiUrl: "https://agentmart.dev" },
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
      fsModule: {
        writeFile: async (filePath, content, encoding) => {
          calls.writes.push({ filePath, content, encoding });
        },
      },
    },
  );

  assert.equal(result.outputPath, "listing_1.txt");
  assert.deepEqual(calls.privateKeyToAccount, ["0xprivate"]);
  assert.equal(calls.wrapFetchWithPayment.length, 1);
  assert.equal(calls.paidFetch.length, 1);
  assert.equal(calls.paidFetch[0].url, "https://agentmart.dev/api/listings/listing_1/content");
  assert.equal(calls.paidFetch[0].init.method, "GET");
  assert.equal(calls.rawFetch.length, 1);
  assert.equal(calls.rawFetch[0].url, "https://download.agentmart.dev/file_1");
  assert.equal(calls.rawFetch[0].init.method, "GET");
  assert.deepEqual(calls.writes, [
    { filePath: "listing_1.txt", content: "paid content", encoding: "utf8" },
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
      fsModule: {
        writeFile: async (filePath, content, encoding) => {
          writes.push({ filePath, content, encoding });
        },
      },
    },
  );

  assert.equal(result.outputPath, "./content.md");
  assert.deepEqual(writes, [
    { filePath: "./content.md", content: "inline content", encoding: "utf8" },
  ]);
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
    }),
    /Failed to download content \(404\)/,
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
    fsModule: { writeFile: async () => {} },
  });

  await action("listing_2", {});
  assert.deepEqual(logs, ["Saved content to listing_2.txt"]);
});
