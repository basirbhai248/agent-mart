import assert from "node:assert/strict";
import test from "node:test";

const { registerCreator } = await import("./http.ts");
const { recoverCreator } = await import("./http.ts");
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
