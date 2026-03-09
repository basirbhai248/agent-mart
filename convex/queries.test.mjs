import assert from "node:assert/strict";
import test from "node:test";

const queries = await import("./queries.ts");

test("getListings returns all listings", async () => {
  const { getListings } = queries;
  const expected = [{ _id: "listing_1" }, { _id: "listing_2" }];
  const ctx = {
    db: {
      query: (table) => {
        assert.equal(table, "listings");
        return {
          collect: async () => expected,
        };
      },
    },
  };

  const result = await getListings._handler(ctx, {});
  assert.equal(result, expected);
});

test("getListing fetches listing by id", async () => {
  const { getListing } = queries;
  const expected = { _id: "listing_1", title: "One" };
  const ctx = {
    db: {
      get: async (id) => {
        assert.equal(id, "listing_1");
        return expected;
      },
    },
  };

  const result = await getListing._handler(ctx, { listingId: "listing_1" });
  assert.equal(result, expected);
});

test("searchListings matches title and description case-insensitively", async () => {
  const { searchListings } = queries;
  const listings = [
    { _id: "listing_1", title: "Alpha Pack", description: "First listing" },
    { _id: "listing_2", title: "Beta", description: "Contains GAMMA data" },
    { _id: "listing_3", title: "Delta", description: "No match" },
  ];
  const ctx = {
    db: {
      query: (table) => {
        assert.equal(table, "listings");
        return {
          collect: async () => listings,
        };
      },
    },
  };

  const titleMatch = await searchListings._handler(ctx, { query: "alpha" });
  assert.deepEqual(titleMatch, [listings[0]]);

  const descriptionMatch = await searchListings._handler(ctx, {
    query: "gamma",
  });
  assert.deepEqual(descriptionMatch, [listings[1]]);
});

test("searchListings returns empty for blank query", async () => {
  const { searchListings } = queries;
  let queryCalled = false;
  const ctx = {
    db: {
      query: () => {
        queryCalled = true;
        return {
          collect: async () => [],
        };
      },
    },
  };

  const result = await searchListings._handler(ctx, { query: "   " });
  assert.deepEqual(result, []);
  assert.equal(queryCalled, false);
});

test("getCreatorByWallet uses by_wallet index and returns unique creator", async () => {
  const { getCreatorByWallet } = queries;
  const expected = { _id: "creator_1", wallet: "0xabc" };
  const calls = [];
  const ctx = {
    db: {
      query: (table) => {
        calls.push(["query", table]);
        return {
          withIndex: (indexName, cb) => {
            calls.push(["withIndex", indexName]);
            const indexBuilder = {
              eq: (field, value) => {
                calls.push(["eq", field, value]);
                return "index_filter";
              },
            };
            cb(indexBuilder);
            return {
              unique: async () => {
                calls.push(["unique"]);
                return expected;
              },
            };
          },
        };
      },
    },
  };

  const result = await getCreatorByWallet._handler(ctx, { wallet: "0xabc" });
  assert.equal(result, expected);
  assert.deepEqual(calls, [
    ["query", "creators"],
    ["withIndex", "by_wallet"],
    ["eq", "wallet", "0xabc"],
    ["unique"],
  ]);
});

test("getCreatorListings uses by_creatorId index and returns listings", async () => {
  const { getCreatorListings } = queries;
  const expected = [{ _id: "listing_1", creatorId: "creator_1" }];
  const calls = [];
  const ctx = {
    db: {
      query: (table) => {
        calls.push(["query", table]);
        return {
          withIndex: (indexName, cb) => {
            calls.push(["withIndex", indexName]);
            const indexBuilder = {
              eq: (field, value) => {
                calls.push(["eq", field, value]);
                return "index_filter";
              },
            };
            cb(indexBuilder);
            return {
              collect: async () => {
                calls.push(["collect"]);
                return expected;
              },
            };
          },
        };
      },
    },
  };

  const result = await getCreatorListings._handler(ctx, {
    creatorId: "creator_1",
  });
  assert.equal(result, expected);
  assert.deepEqual(calls, [
    ["query", "listings"],
    ["withIndex", "by_creatorId"],
    ["eq", "creatorId", "creator_1"],
    ["collect"],
  ]);
});

test("getPurchase fetches purchase by id", async () => {
  const { getPurchase } = queries;
  const expected = { _id: "purchase_1", txHash: "0xtx" };
  const ctx = {
    db: {
      get: async (id) => {
        assert.equal(id, "purchase_1");
        return expected;
      },
    },
  };

  const result = await getPurchase._handler(ctx, { purchaseId: "purchase_1" });
  assert.equal(result, expected);
});
