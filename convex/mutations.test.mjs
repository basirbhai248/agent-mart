import assert from "node:assert/strict";
import test from "node:test";

const mutations = await import("./mutations.ts");

test("createCreator inserts into creators with createdAt timestamp", async () => {
  const { createCreator } = mutations;
  const inserts = [];
  const now = 1710000000000;
  const originalDateNow = Date.now;
  Date.now = () => now;

  try {
    const ctx = {
      db: {
        insert: async (table, value) => {
          inserts.push({ table, value });
          return "creator_1";
        },
      },
    };

    const result = await createCreator._handler(ctx, {
      wallet: "0xabc",
      displayName: "alice",
      bio: "builder",
      twitterHandle: "@alice",
      apiKey: "key_123",
    });

    assert.equal(result, "creator_1");
    assert.deepEqual(inserts, [
      {
        table: "creators",
        value: {
          wallet: "0xabc",
          displayName: "alice",
          bio: "builder",
          twitterHandle: "@alice",
          apiKey: "key_123",
          createdAt: now,
        },
      },
    ]);
  } finally {
    Date.now = originalDateNow;
  }
});

test("createListing throws if creator does not exist", async () => {
  const { createListing } = mutations;
  const ctx = {
    db: {
      get: async () => null,
      insert: async () => "listing_1",
    },
  };

  await assert.rejects(
    createListing._handler(ctx, {
      creatorId: "creator_missing",
      title: "Title",
      description: "Desc",
      priceUsdc: 10,
      fileStorageId: "file_1",
    }),
    /Creator not found/,
  );
});

test("createListing inserts into listings when creator exists", async () => {
  const { createListing } = mutations;
  const inserts = [];
  const now = 1710000000001;
  const originalDateNow = Date.now;
  Date.now = () => now;

  try {
    const ctx = {
      db: {
        get: async () => ({ _id: "creator_1" }),
        insert: async (table, value) => {
          inserts.push({ table, value });
          return "listing_1";
        },
      },
    };

    const result = await createListing._handler(ctx, {
      creatorId: "creator_1",
      title: "Title",
      description: "Desc",
      priceUsdc: 10,
      fileStorageId: "file_1",
    });

    assert.equal(result, "listing_1");
    assert.deepEqual(inserts, [
      {
        table: "listings",
        value: {
          creatorId: "creator_1",
          title: "Title",
          description: "Desc",
          priceUsdc: 10,
          fileStorageId: "file_1",
          createdAt: now,
        },
      },
    ]);
  } finally {
    Date.now = originalDateNow;
  }
});

test("recordPurchase throws if listing does not exist", async () => {
  const { recordPurchase } = mutations;
  const ctx = {
    db: {
      get: async () => null,
      insert: async () => "purchase_1",
    },
  };

  await assert.rejects(
    recordPurchase._handler(ctx, {
      listingId: "listing_missing",
      buyerWallet: "0xbuyer",
      amountPaid: 25,
      txHash: "0xtx",
    }),
    /Listing not found/,
  );
});

test("recordPurchase inserts into purchases when listing exists", async () => {
  const { recordPurchase } = mutations;
  const inserts = [];
  const now = 1710000000002;
  const originalDateNow = Date.now;
  Date.now = () => now;

  try {
    const ctx = {
      db: {
        get: async () => ({ _id: "listing_1" }),
        insert: async (table, value) => {
          inserts.push({ table, value });
          return "purchase_1";
        },
      },
    };

    const result = await recordPurchase._handler(ctx, {
      listingId: "listing_1",
      buyerWallet: "0xbuyer",
      amountPaid: 25,
      txHash: "0xtx",
    });

    assert.equal(result, "purchase_1");
    assert.deepEqual(inserts, [
      {
        table: "purchases",
        value: {
          listingId: "listing_1",
          buyerWallet: "0xbuyer",
          amountPaid: 25,
          txHash: "0xtx",
          createdAt: now,
        },
      },
    ]);
  } finally {
    Date.now = originalDateNow;
  }
});
