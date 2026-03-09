import assert from "node:assert/strict";
import test from "node:test";

const { registerCreator } = await import("./http.ts");
const { recoverCreator } = await import("./http.ts");
const { createListingRoute } = await import("./http.ts");
const { listListingsRoute } = await import("./http.ts");
const { searchListingsRoute } = await import("./http.ts");
const { getListingRoute } = await import("./http.ts");
const { getListingContentRoute } = await import("./http.ts");
const { buildRecoveryMessage, privateKeyToWalletAddress, signRecoveryMessage } =
  await import("./wallet.ts");

test("registerCreator returns 400 for invalid JSON", async () => {
  const ctx = {
    runQuery: async () => null,
    runMutation: async () => "creator_1",
  };

  const request = new Request("https://example.com/api/register", {
    method: "POST",
    body: "{",
  });

  const response = await registerCreator._handler(ctx, request);

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "Invalid JSON body" });
});

test("registerCreator returns 400 when required fields are missing", async () => {
  let queryCalled = false;
  let mutationCalled = false;
  const ctx = {
    runQuery: async () => {
      queryCalled = true;
      return null;
    },
    runMutation: async () => {
      mutationCalled = true;
      return "creator_1";
    },
  };

  const request = new Request("https://example.com/api/register", {
    method: "POST",
    body: JSON.stringify({ wallet: "0xabc", bio: "builder" }),
  });

  const response = await registerCreator._handler(ctx, request);

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: "wallet, displayName, and bio are required",
  });
  assert.equal(queryCalled, false);
  assert.equal(mutationCalled, false);
});

test("registerCreator returns 409 when wallet is already registered", async () => {
  let mutationCalled = false;
  const queryCalls = [];
  const ctx = {
    runQuery: async (ref, args) => {
      queryCalls.push({ ref, args });
      return { _id: "creator_existing" };
    },
    runMutation: async () => {
      mutationCalled = true;
      return "creator_1";
    },
  };

  const request = new Request("https://example.com/api/register", {
    method: "POST",
    body: JSON.stringify({
      wallet: "0xabc",
      displayName: "Alice",
      bio: "builder",
    }),
  });

  const response = await registerCreator._handler(ctx, request);

  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), {
    error: "Creator already registered for wallet",
  });
  assert.equal(queryCalls.length, 1);
  assert.deepEqual(queryCalls[0].args, { wallet: "0xabc" });
  assert.equal(mutationCalled, false);
});

test("registerCreator creates creator and returns api key", async () => {
  const queryCalls = [];
  const mutationCalls = [];
  const originalRandomUUID = crypto.randomUUID;
  crypto.randomUUID = () => "api-key-123";

  try {
    const ctx = {
      runQuery: async (ref, args) => {
        queryCalls.push({ ref, args });
        return null;
      },
      runMutation: async (ref, args) => {
        mutationCalls.push({ ref, args });
        return "creator_1";
      },
    };

    const request = new Request("https://example.com/api/register", {
      method: "POST",
      body: JSON.stringify({
        wallet: " 0xabc ",
        name: " Alice ",
        bio: " builder ",
        twitterHandle: " @alice ",
      }),
    });

    const response = await registerCreator._handler(ctx, request);

    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), {
      creatorId: "creator_1",
      apiKey: "api-key-123",
    });

    assert.equal(queryCalls.length, 1);
    assert.deepEqual(queryCalls[0].args, { wallet: "0xabc" });

    assert.equal(mutationCalls.length, 1);
    assert.deepEqual(mutationCalls[0].args, {
      wallet: "0xabc",
      displayName: "Alice",
      bio: "builder",
      twitterHandle: "@alice",
      apiKey: "api-key-123",
    });
  } finally {
    crypto.randomUUID = originalRandomUUID;
  }
});

test("recoverCreator returns 400 for invalid JSON", async () => {
  const ctx = {
    runQuery: async () => null,
    runMutation: async () => null,
  };

  const request = new Request("https://example.com/api/recover", {
    method: "POST",
    body: "{",
  });

  const response = await recoverCreator._handler(ctx, request);

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "Invalid JSON body" });
});

test("recoverCreator returns 400 when required fields are missing", async () => {
  let queryCalled = false;
  let mutationCalled = false;
  const ctx = {
    runQuery: async () => {
      queryCalled = true;
      return null;
    },
    runMutation: async () => {
      mutationCalled = true;
      return null;
    },
  };

  const request = new Request("https://example.com/api/recover", {
    method: "POST",
    body: JSON.stringify({ wallet: "0xabc" }),
  });

  const response = await recoverCreator._handler(ctx, request);

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: "wallet and signature are required",
  });
  assert.equal(queryCalled, false);
  assert.equal(mutationCalled, false);
});

test("recoverCreator returns 404 when wallet is not registered", async () => {
  const queryCalls = [];
  let mutationCalled = false;
  const ctx = {
    runQuery: async (ref, args) => {
      queryCalls.push({ ref, args });
      return null;
    },
    runMutation: async () => {
      mutationCalled = true;
      return null;
    },
  };

  const request = new Request("https://example.com/api/recover", {
    method: "POST",
    body: JSON.stringify({
      wallet: "0xabc",
      signature: "0x01",
    }),
  });

  const response = await recoverCreator._handler(ctx, request);

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), {
    error: "Creator not found for wallet",
  });
  assert.equal(queryCalls.length, 1);
  assert.equal(mutationCalled, false);
});

test("recoverCreator returns 401 for invalid signature", async () => {
  let mutationCalled = false;
  const ctx = {
    runQuery: async () => ({ _id: "creator_1" }),
    runMutation: async () => {
      mutationCalled = true;
      return null;
    },
  };

  const request = new Request("https://example.com/api/recover", {
    method: "POST",
    body: JSON.stringify({
      wallet: "0xabc",
      signature: "0x01",
    }),
  });

  const response = await recoverCreator._handler(ctx, request);

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    error: "Invalid wallet signature",
  });
  assert.equal(mutationCalled, false);
});

test("recoverCreator rotates api key for valid signature", async () => {
  const privateKey =
    "0x4c0883a6910395b7a17bdb50f8a7f4c6f9a6f90f3f74f4df2f1a94ff4cbf1d38";
  const wallet = privateKeyToWalletAddress(privateKey);
  const signature = signRecoveryMessage(
    privateKey,
    buildRecoveryMessage(wallet),
  );
  const queryCalls = [];
  const mutationCalls = [];
  const originalRandomUUID = crypto.randomUUID;
  crypto.randomUUID = () => "rotated-key-123";

  try {
    const ctx = {
      runQuery: async (ref, args) => {
        queryCalls.push({ ref, args });
        return { _id: "creator_1", wallet };
      },
      runMutation: async (ref, args) => {
        mutationCalls.push({ ref, args });
        return "creator_1";
      },
    };

    const request = new Request("https://example.com/api/recover", {
      method: "POST",
      body: JSON.stringify({
        wallet,
        signature,
      }),
    });

    const response = await recoverCreator._handler(ctx, request);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      creatorId: "creator_1",
      apiKey: "rotated-key-123",
    });
    assert.equal(queryCalls.length, 1);
    assert.deepEqual(queryCalls[0].args, { wallet });
    assert.equal(mutationCalls.length, 1);
    assert.deepEqual(mutationCalls[0].args, {
      creatorId: "creator_1",
      apiKey: "rotated-key-123",
    });
  } finally {
    crypto.randomUUID = originalRandomUUID;
  }
});

test("createListingRoute returns 401 when API key is missing", async () => {
  let queryCalled = false;
  let mutationCalled = false;
  const ctx = {
    runQuery: async () => {
      queryCalled = true;
      return null;
    },
    runMutation: async () => {
      mutationCalled = true;
      return "listing_1";
    },
  };

  const request = new Request("https://example.com/api/listings", {
    method: "POST",
    body: JSON.stringify({
      title: "Alpha",
      description: "Desc",
      priceUsdc: 10,
      fileStorageId: "file_1",
    }),
  });

  const response = await createListingRoute._handler(ctx, request);

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "API key required" });
  assert.equal(queryCalled, false);
  assert.equal(mutationCalled, false);
});

test("createListingRoute returns 401 for invalid API key", async () => {
  let mutationCalled = false;
  const queryCalls = [];
  const ctx = {
    runQuery: async (ref, args) => {
      queryCalls.push({ ref, args });
      return null;
    },
    runMutation: async () => {
      mutationCalled = true;
      return "listing_1";
    },
  };

  const request = new Request("https://example.com/api/listings", {
    method: "POST",
    headers: {
      authorization: "Bearer key_bad",
    },
    body: JSON.stringify({
      title: "Alpha",
      description: "Desc",
      priceUsdc: 10,
      fileStorageId: "file_1",
    }),
  });

  const response = await createListingRoute._handler(ctx, request);

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "Invalid API key" });
  assert.equal(queryCalls.length, 1);
  assert.deepEqual(queryCalls[0].args, { apiKey: "key_bad" });
  assert.equal(mutationCalled, false);
});

test("createListingRoute returns 400 when required fields are missing", async () => {
  const queryCalls = [];
  let mutationCalled = false;
  const ctx = {
    runQuery: async (ref, args) => {
      queryCalls.push({ ref, args });
      return { _id: "creator_1" };
    },
    runMutation: async () => {
      mutationCalled = true;
      return "listing_1";
    },
  };

  const request = new Request("https://example.com/api/listings", {
    method: "POST",
    headers: {
      authorization: "Bearer key_123",
    },
    body: JSON.stringify({
      title: "Alpha",
      description: "Desc",
      priceUsdc: 0,
    }),
  });

  const response = await createListingRoute._handler(ctx, request);

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: "title, description, priceUsdc, and fileStorageId are required",
  });
  assert.equal(queryCalls.length, 1);
  assert.deepEqual(queryCalls[0].args, { apiKey: "key_123" });
  assert.equal(mutationCalled, false);
});

test("createListingRoute creates listing for valid API key and payload", async () => {
  const queryCalls = [];
  const mutationCalls = [];
  const ctx = {
    runQuery: async (ref, args) => {
      queryCalls.push({ ref, args });
      return { _id: "creator_1" };
    },
    runMutation: async (ref, args) => {
      mutationCalls.push({ ref, args });
      return "listing_1";
    },
  };

  const request = new Request("https://example.com/api/listings", {
    method: "POST",
    headers: {
      authorization: "Bearer key_123",
    },
    body: JSON.stringify({
      title: " Alpha ",
      description: " Desc ",
      priceUsdc: 10,
      fileStorageId: " file_1 ",
    }),
  });

  const response = await createListingRoute._handler(ctx, request);

  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { listingId: "listing_1" });
  assert.equal(queryCalls.length, 1);
  assert.deepEqual(queryCalls[0].args, { apiKey: "key_123" });
  assert.equal(mutationCalls.length, 1);
  assert.deepEqual(mutationCalls[0].args, {
    creatorId: "creator_1",
    title: "Alpha",
    description: "Desc",
    priceUsdc: 10,
    fileStorageId: "file_1",
  });
});

test("listListingsRoute returns 405 for non-GET methods", async () => {
  let queryCalled = false;
  const ctx = {
    runQuery: async () => {
      queryCalled = true;
      return [];
    },
  };

  const request = new Request("https://example.com/api/listings", {
    method: "POST",
  });

  const response = await listListingsRoute._handler(ctx, request);

  assert.equal(response.status, 405);
  assert.deepEqual(await response.json(), { error: "Method not allowed" });
  assert.equal(queryCalled, false);
});

test("listListingsRoute returns all listings", async () => {
  const queryCalls = [];
  const listings = [
    { _id: "listing_1", title: "Alpha", priceUsdc: 10 },
    { _id: "listing_2", title: "Beta", priceUsdc: 20 },
  ];
  const ctx = {
    runQuery: async (ref, args) => {
      queryCalls.push({ ref, args });
      return listings;
    },
  };

  const request = new Request("https://example.com/api/listings", {
    method: "GET",
  });

  const response = await listListingsRoute._handler(ctx, request);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), listings);
  assert.equal(queryCalls.length, 1);
  assert.deepEqual(queryCalls[0].args, {});
});

test("searchListingsRoute returns 405 for non-GET methods", async () => {
  let queryCalled = false;
  const ctx = {
    runQuery: async () => {
      queryCalled = true;
      return [];
    },
  };

  const request = new Request("https://example.com/api/search?q=alpha", {
    method: "POST",
  });

  const response = await searchListingsRoute._handler(ctx, request);

  assert.equal(response.status, 405);
  assert.deepEqual(await response.json(), { error: "Method not allowed" });
  assert.equal(queryCalled, false);
});

test("searchListingsRoute returns matching listings", async () => {
  const queryCalls = [];
  const listings = [{ _id: "listing_1", title: "Alpha", priceUsdc: 10 }];
  const ctx = {
    runQuery: async (ref, args) => {
      queryCalls.push({ ref, args });
      return listings;
    },
  };

  const request = new Request("https://example.com/api/search?q=%20alpha%20", {
    method: "GET",
  });

  const response = await searchListingsRoute._handler(ctx, request);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), listings);
  assert.equal(queryCalls.length, 1);
  assert.deepEqual(queryCalls[0].args, { query: " alpha " });
});

test("getListingRoute returns 405 for non-GET methods", async () => {
  let queryCalled = false;
  const ctx = {
    runQuery: async () => {
      queryCalled = true;
      return null;
    },
  };

  const request = new Request("https://example.com/api/listings/listing_1", {
    method: "POST",
  });

  const response = await getListingRoute._handler(ctx, request);

  assert.equal(response.status, 405);
  assert.deepEqual(await response.json(), { error: "Method not allowed" });
  assert.equal(queryCalled, false);
});

test("getListingRoute returns 404 when listing does not exist", async () => {
  const queryCalls = [];
  const ctx = {
    runQuery: async (ref, args) => {
      queryCalls.push({ ref, args });
      return null;
    },
  };

  const request = new Request("https://example.com/api/listings/listing_1", {
    method: "GET",
  });

  const response = await getListingRoute._handler(ctx, request);

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: "Listing not found" });
  assert.equal(queryCalls.length, 1);
  assert.deepEqual(queryCalls[0].args, { listingId: "listing_1" });
});

test("getListingRoute returns listing metadata by id", async () => {
  const queryCalls = [];
  const listing = {
    _id: "listing_1",
    title: "Alpha",
    description: "A listing",
    priceUsdc: 12,
  };
  const ctx = {
    runQuery: async (ref, args) => {
      queryCalls.push({ ref, args });
      return listing;
    },
  };

  const request = new Request("https://example.com/api/listings/listing_1", {
    method: "GET",
  });

  const response = await getListingRoute._handler(ctx, request);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), listing);
  assert.equal(queryCalls.length, 1);
  assert.deepEqual(queryCalls[0].args, { listingId: "listing_1" });
});

test("getListingContentRoute returns 405 for non-GET methods", async () => {
  let queryCalled = false;
  const ctx = {
    runQuery: async () => {
      queryCalled = true;
      return null;
    },
    runMutation: async () => "purchase_1",
  };

  const request = new Request(
    "https://example.com/api/listings/listing_1/content",
    {
      method: "POST",
    },
  );

  const response = await getListingContentRoute._handler(ctx, request);

  assert.equal(response.status, 405);
  assert.deepEqual(await response.json(), { error: "Method not allowed" });
  assert.equal(queryCalled, false);
});

test("getListingContentRoute returns 404 when listing does not exist", async () => {
  const queryCalls = [];
  const ctx = {
    runQuery: async (ref, args) => {
      queryCalls.push({ ref, args });
      return null;
    },
    runMutation: async () => "purchase_1",
  };

  const request = new Request(
    "https://example.com/api/listings/listing_1/content",
    {
      method: "GET",
    },
  );

  const response = await getListingContentRoute._handler(ctx, request);

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: "Listing not found" });
  assert.equal(queryCalls.length, 1);
  assert.deepEqual(queryCalls[0].args, { listingId: "listing_1" });
});

test("getListingContentRoute returns 402 with payment requirements when unpaid", async () => {
  const queryCalls = [];
  const originalPlatformWallet = process.env.PLATFORM_WALLET;
  process.env.PLATFORM_WALLET = "0xplatform";

  try {
    const ctx = {
      runQuery: async (ref, args) => {
        queryCalls.push({ ref, args });
        return {
          _id: "listing_1",
          priceUsdc: 25,
          fileStorageId: "file_1",
        };
      },
      runMutation: async () => "purchase_1",
    };

    const request = new Request(
      "https://example.com/api/listings/listing_1/content",
      {
        method: "GET",
      },
    );

    const response = await getListingContentRoute._handler(ctx, request);

    assert.equal(response.status, 402);
    assert.deepEqual(await response.json(), {
      error: "Payment required",
      payment: {
        scheme: "x402",
        network: "base",
        currency: "USDC",
        amountUsdc: 25,
        destinationWallet: "0xplatform",
      },
    });
    assert.equal(queryCalls.length, 1);
    assert.deepEqual(queryCalls[0].args, { listingId: "listing_1" });
  } finally {
    if (originalPlatformWallet === undefined) {
      delete process.env.PLATFORM_WALLET;
    } else {
      process.env.PLATFORM_WALLET = originalPlatformWallet;
    }
  }
});

test("getListingContentRoute returns content without payment when already purchased", async () => {
  const queryCalls = [];
  let mutationCalled = false;
  const listing = {
    _id: "listing_1",
    priceUsdc: 25,
    fileStorageId: "file_1",
  };
  const existingPurchase = {
    _id: "purchase_1",
    listingId: "listing_1",
    buyerWallet: "0xbuyer",
  };
  const ctx = {
    runQuery: async (ref, args) => {
      queryCalls.push({ ref, args });
      return queryCalls.length === 1 ? listing : existingPurchase;
    },
    runMutation: async () => {
      mutationCalled = true;
      return "purchase_2";
    },
    storage: {
      getUrl: async (id) => `https://cdn.example/${id}`,
    },
  };

  const request = new Request(
    "https://example.com/api/listings/listing_1/content",
    {
      method: "GET",
      headers: {
        "x-buyer-wallet": "0xbuyer",
      },
    },
  );

  const response = await getListingContentRoute._handler(ctx, request);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    listingId: "listing_1",
    buyerWallet: "0xbuyer",
    hasPurchased: true,
    fileStorageId: "file_1",
    contentUrl: "https://cdn.example/file_1",
  });
  assert.equal(queryCalls.length, 2);
  assert.deepEqual(queryCalls[0].args, { listingId: "listing_1" });
  assert.deepEqual(queryCalls[1].args, {
    listingId: "listing_1",
    buyerWallet: "0xbuyer",
  });
  assert.equal(mutationCalled, false);
});

test("getListingContentRoute records purchase and returns content for paid request", async () => {
  const queryCalls = [];
  const mutationCalls = [];
  const listing = {
    _id: "listing_1",
    priceUsdc: 25,
    fileStorageId: "file_1",
  };
  const ctx = {
    runQuery: async (ref, args) => {
      queryCalls.push({ ref, args });
      return queryCalls.length === 1 ? listing : null;
    },
    runMutation: async (ref, args) => {
      mutationCalls.push({ ref, args });
      return "purchase_1";
    },
  };

  const request = new Request(
    "https://example.com/api/listings/listing_1/content",
    {
      method: "GET",
      headers: {
        "x-buyer-wallet": "0xbuyer",
        "x-payment-tx": "0xtxhash",
      },
    },
  );

  const response = await getListingContentRoute._handler(ctx, request);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    listingId: "listing_1",
    buyerWallet: "0xbuyer",
    hasPurchased: false,
    fileStorageId: "file_1",
    contentUrl: null,
  });
  assert.equal(queryCalls.length, 2);
  assert.deepEqual(queryCalls[0].args, { listingId: "listing_1" });
  assert.deepEqual(queryCalls[1].args, {
    listingId: "listing_1",
    buyerWallet: "0xbuyer",
  });
  assert.equal(mutationCalls.length, 1);
  assert.deepEqual(mutationCalls[0].args, {
    listingId: "listing_1",
    buyerWallet: "0xbuyer",
    amountPaid: 25,
    txHash: "0xtxhash",
  });
});
