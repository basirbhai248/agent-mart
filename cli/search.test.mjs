import assert from "node:assert/strict";
import test from "node:test";

import {
  createSearchAction,
  formatSearchResultsTable,
  searchListings,
} from "./bin/search.js";

test("searchListings calls GET /api/search with encoded query", async () => {
  const calls = [];

  const result = await searchListings(
    " alpha beta ",
    { apiUrl: "https://agentmart.dev" },
    {
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), init });
        return new Response(
          JSON.stringify([
            {
              _id: "listing_1",
              title: "Alpha Beta Guide",
              priceUsdc: 1.5,
              creatorId: "creator_1",
            },
          ]),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      },
    },
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://agentmart.dev/api/search?q=alpha+beta");
  assert.equal(calls[0].init.method, "GET");
  assert.equal(Array.isArray(result), true);
  assert.equal(result.length, 1);
});

test("searchListings validates query and surfaces API errors", async () => {
  await assert.rejects(searchListings("   "), /<query> is required/);

  await assert.rejects(
    searchListings("alpha", {}, {
      fetchImpl: async () =>
        new Response(JSON.stringify({ error: "bad query" }), {
          status: 400,
          headers: { "content-type": "application/json" },
        }),
    }),
    /Search failed \(400\): bad query/,
  );
});

test("searchListings reads full chunked response body before parsing JSON", async () => {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode('[{"_id":"listing_1",'));
      controller.enqueue(
        encoder.encode('"title":"Chunked","priceUsdc":1,"creatorId":"creator_1"}]'),
      );
      controller.close();
    },
  });

  const result = await searchListings(
    "chunked",
    { apiUrl: "https://agentmart.dev" },
    {
      fetchImpl: async () => ({
        ok: true,
        status: 200,
        body,
      }),
    },
  );

  assert.equal(Array.isArray(result), true);
  assert.equal(result.length, 1);
  assert.equal(result[0].title, "Chunked");
});

test("formatSearchResultsTable renders formatted rows", () => {
  const table = formatSearchResultsTable([
    {
      _id: "listing_1",
      title: "Alpha Guide",
      priceUsdc: 2,
      creatorId: "creator_1",
    },
    {
      id: "listing_2",
      title: "Beta Guide",
      price: "3.25",
      creatorName: "Builder",
    },
  ]);

  assert.match(table, /^ID\s+\|\s+title\s+\|\s+price\s+\|\s+creator/m);
  assert.match(table, /listing_1\s+\|\s+Alpha Guide\s+\|\s+2\.00\s+\|\s+creator_1/);
  assert.match(table, /listing_2\s+\|\s+Beta Guide\s+\|\s+3\.25\s+\|\s+Builder/);
});

test("createSearchAction logs table output", async () => {
  const logs = [];
  const action = createSearchAction({
    logger: { log: (line) => logs.push(line) },
    fetchImpl: async () =>
      new Response(
        JSON.stringify([
          {
            _id: "listing_9",
            title: "Gamma Guide",
            priceUsdc: 5,
            creatorId: "creator_9",
          },
        ]),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      ),
  });

  await action("gamma", { apiUrl: "https://agentmart.dev" });

  assert.equal(logs.length, 1);
  assert.match(logs[0], /ID\s+\|\s+title\s+\|\s+price\s+\|\s+creator/);
  assert.match(logs[0], /listing_9/);
});

test("createSearchAction falls back to no results on network fetch failures", async () => {
  const logs = [];
  const action = createSearchAction({
    logger: { log: (line) => logs.push(line) },
    fetchImpl: async () => {
      const dnsError = new Error("dns lookup failed");
      dnsError.code = "EAI_AGAIN";
      throw new TypeError("fetch failed", { cause: dnsError });
    },
  });

  await action("Twitter", { apiUrl: "https://agentmart.dev" });

  assert.equal(logs.length, 1);
  assert.equal(logs[0], "No results found.");
});

test("createSearchAction rethrows non-network search errors", async () => {
  const action = createSearchAction({
    logger: { log: () => {} },
    fetchImpl: async () =>
      new Response(JSON.stringify({ error: "invalid response" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      }),
  });

  await assert.rejects(
    action("Twitter", { apiUrl: "https://agentmart.dev" }),
    /Search failed \(500\): invalid response/,
  );
});
