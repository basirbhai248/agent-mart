import assert from "node:assert/strict";
import test from "node:test";

import {
  createListAction,
  formatCreatorListingsTable,
  getCreatorListings,
} from "./bin/list.js";

test("getCreatorListings calls GET /api/creators/<wallet>", async () => {
  const calls = [];

  const payload = await getCreatorListings(
    {
      creator: " 0xabc ",
      apiUrl: "https://agentmart.dev",
    },
    {
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), init });
        return new Response(
          JSON.stringify({
            creator: { wallet: "0xabc", displayName: "Builder" },
            listings: [{ _id: "listing_1", title: "Alpha", priceUsdc: 2 }],
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      },
    },
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://agentmart.dev/api/creators/0xabc");
  assert.equal(calls[0].init.method, "GET");
  assert.equal(payload.listings.length, 1);
});

test("getCreatorListings validates creator option and API errors", async () => {
  await assert.rejects(getCreatorListings({ creator: "   " }), /--creator is required/);

  await assert.rejects(
    getCreatorListings(
      { creator: "0xabc" },
      {
        fetchImpl: async () =>
          new Response(JSON.stringify({ error: "Creator not found" }), {
            status: 404,
            headers: { "content-type": "application/json" },
          }),
      },
    ),
    /List failed \(404\): Creator not found/,
  );
});

test("getCreatorListings validates response shape", async () => {
  await assert.rejects(
    getCreatorListings(
      { creator: "0xabc" },
      {
        fetchImpl: async () =>
          new Response(JSON.stringify({ creator: { wallet: "0xabc" } }), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
      },
    ),
    /List response must include a listings array/,
  );
});

test("formatCreatorListingsTable renders rows with creator fallback", () => {
  const table = formatCreatorListingsTable(
    [
      { _id: "listing_1", title: "Alpha", priceUsdc: 2 },
      { id: "listing_2", title: "Beta", price: "3.25", creatorName: "Other" },
    ],
    { wallet: "0xabc", displayName: "Builder" },
  );

  assert.match(table, /^ID\s+\|\s+title\s+\|\s+price\s+\|\s+creator/m);
  assert.match(table, /listing_1\s+\|\s+Alpha\s+\|\s+2\.00\s+\|\s+Builder/);
  assert.match(table, /listing_2\s+\|\s+Beta\s+\|\s+3\.25\s+\|\s+Other/);

  assert.equal(formatCreatorListingsTable([], { wallet: "0xabc" }), "No listings found.");
});

test("createListAction logs table output", async () => {
  const logs = [];
  const action = createListAction({
    logger: { log: (line) => logs.push(line) },
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          creator: { wallet: "0xabc", displayName: "Builder" },
          listings: [{ _id: "listing_9", title: "Gamma", priceUsdc: 5 }],
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
  });

  await action({ creator: "0xabc", apiUrl: "https://agentmart.dev" });

  assert.equal(logs.length, 1);
  assert.match(logs[0], /ID\s+\|\s+title\s+\|\s+price\s+\|\s+creator/);
  assert.match(logs[0], /listing_9/);
});
