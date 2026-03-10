import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

import {
  checkPurchasedContentUpdates,
  createUpdatesAction,
} from "./bin/updates.js";

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

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

test("checkPurchasedContentUpdates updates changed purchased content", async () => {
  const writes = [];
  const recorded = [];
  const paymentClients = [];

  const result = await checkPurchasedContentUpdates(
    { apiUrl: "https://agentmart.dev" },
    {
      fsModule: {
        readFile: async () =>
          JSON.stringify({
            purchases: [
              {
                listingId: "listing_1",
                outputPath: "listing_1.txt",
                contentSha256: sha256("old content"),
              },
            ],
          }),
        writeFile: async (filePath, content, encoding) => {
          writes.push({ filePath, content, encoding });
        },
      },
      resolvePrivateKey: async () => "0xprivate",
      privateKeyToAccount: () => ({ address: "0xabc" }),
      wrapFetchWithPayment: (_fetchImpl, paymentClient) => {
        paymentClients.push(paymentClient);
        return async () =>
          new Response(JSON.stringify({ content: "new content" }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
      },
      x402ClientCtor: FakeX402Client,
      exactEvmSchemeCtor: FakeExactEvmScheme,
      exactEvmSchemeV1Ctor: FakeExactEvmSchemeV1,
      recordPurchasedContent: async (purchase) => {
        recorded.push(purchase);
      },
    },
  );

  assert.equal(result.checked, 1);
  assert.deepEqual(result.updated, [
    { listingId: "listing_1", outputPath: "listing_1.txt" },
  ]);
  assert.deepEqual(writes, [
    { filePath: "listing_1.txt", content: "new content", encoding: "utf8" },
  ]);
  assert.deepEqual(recorded, [
    {
      listingId: "listing_1",
      outputPath: "listing_1.txt",
      content: "new content",
    },
  ]);
  assert.equal(paymentClients.length, 1);
  assert.deepEqual(
    paymentClients[0].registerCalls.map(({ network }) => network),
    ["base", "eip155:8453", "eip155:*"],
  );
  assert.deepEqual(
    paymentClients[0].registerV1Calls.map(({ network }) => network),
    ["base"],
  );
});

test("checkPurchasedContentUpdates reports no updates when content hash is unchanged", async () => {
  const writes = [];
  const content = "same content";

  const result = await checkPurchasedContentUpdates(
    { apiUrl: "https://agentmart.dev" },
    {
      fsModule: {
        readFile: async () =>
          JSON.stringify({
            purchases: [
              {
                listingId: "listing_2",
                outputPath: "listing_2.txt",
                contentSha256: sha256(content),
              },
            ],
          }),
        writeFile: async (filePath, value, encoding) => {
          writes.push({ filePath, value, encoding });
        },
      },
      resolvePrivateKey: async () => "0xprivate",
      privateKeyToAccount: () => ({ address: "0xabc" }),
      wrapFetchWithPayment: () => {
        return async () =>
          new Response(JSON.stringify({ content }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
      },
      recordPurchasedContent: async () => {
        throw new Error("recordPurchasedContent should not be called");
      },
    },
  );

  assert.equal(result.checked, 1);
  assert.deepEqual(result.updated, []);
  assert.deepEqual(writes, []);
});

test("checkPurchasedContentUpdates validates private key and API errors", async () => {
  await assert.rejects(
    checkPurchasedContentUpdates(
      {},
      {
        fsModule: {
          readFile: async () =>
            JSON.stringify({
              purchases: [
                { listingId: "listing_1", outputPath: "listing_1.txt" },
              ],
            }),
        },
        resolvePrivateKey: async () => undefined,
      },
    ),
    /Missing private key/,
  );

  await assert.rejects(
    checkPurchasedContentUpdates(
      {},
      {
        fsModule: {
          readFile: async () =>
            JSON.stringify({
              purchases: [
                { listingId: "listing_1", outputPath: "listing_1.txt" },
              ],
            }),
        },
        resolvePrivateKey: async () => "0xprivate",
        privateKeyToAccount: () => ({ address: "0xabc" }),
        wrapFetchWithPayment: () => {
          return async () =>
            new Response(JSON.stringify({ error: "failed" }), {
              status: 500,
              headers: { "content-type": "application/json" },
            });
        },
      },
    ),
    /Updates failed for listing_1 \(500\): failed/,
  );
});

test("createUpdatesAction logs empty and updated states", async () => {
  const emptyLogs = [];
  const emptyAction = createUpdatesAction({
    logger: { log: (line) => emptyLogs.push(line) },
    fsModule: {
      readFile: async () => JSON.stringify({ purchases: [] }),
    },
  });
  await emptyAction({});
  assert.deepEqual(emptyLogs, ["No purchased listings found."]);

  const updatedLogs = [];
  const updatedAction = createUpdatesAction({
    logger: { log: (line) => updatedLogs.push(line) },
    fsModule: {
      readFile: async () =>
        JSON.stringify({
          purchases: [{ listingId: "listing_7", outputPath: "listing_7.txt" }],
        }),
      writeFile: async () => {},
    },
    resolvePrivateKey: async () => "0xprivate",
    privateKeyToAccount: () => ({ address: "0xabc" }),
    wrapFetchWithPayment: () => {
      return async () =>
        new Response(JSON.stringify({ content: "next" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
    },
    recordPurchasedContent: async () => {},
  });
  await updatedAction({});
  assert.deepEqual(updatedLogs, [
    "Updated 1 of 1 purchased listing(s):",
    "- listing_7 -> listing_7.txt",
  ]);
});
