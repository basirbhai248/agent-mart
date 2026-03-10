import assert from "node:assert/strict";
import test from "node:test";

import {
  createRegisterAction,
  normalizeRequiredOption,
  registerCreator,
  resolveApiUrl,
  resolvePaymentNetwork,
} from "./bin/register.js";

class FakeExactEvmScheme {
  constructor(account) {
    this.account = account;
  }
}

class FakeX402Client {
  constructor() {
    this.registerCalls = [];
  }

  register(network, scheme) {
    this.registerCalls.push({ network, scheme });
    return this;
  }
}

test("normalizeRequiredOption trims and validates values", () => {
  assert.equal(normalizeRequiredOption(" value ", "--wallet"), "value");
  assert.throws(() => normalizeRequiredOption("", "--wallet"), /required/);
  assert.throws(() => normalizeRequiredOption("   ", "--wallet"), /required/);
});

test("resolveApiUrl uses explicit value, env fallback, then default", () => {
  assert.equal(
    resolveApiUrl({ apiUrl: "https://example.com/" }),
    "https://example.com/",
  );
  assert.equal(
    resolveApiUrl({ env: { AGENTMART_API_URL: "https://agentmart.dev" } }),
    "https://agentmart.dev/",
  );
  assert.equal(resolveApiUrl({ env: {} }), "https://agent-mart-beryl.vercel.app/");
});

test("resolvePaymentNetwork uses flag or env var for Base Sepolia", () => {
  assert.equal(resolvePaymentNetwork({}), "base");
  assert.equal(resolvePaymentNetwork({ testnet: true }), "base-sepolia");
  assert.equal(
    resolvePaymentNetwork({ env: { AGENTMART_TESTNET: "true" } }),
    "base-sepolia",
  );
});

test("registerCreator posts /api/register and returns api key", async () => {
  const calls = {
    privateKeyToAccount: [],
    wrapFetchWithPayment: [],
    paidFetch: [],
  };

  const result = await registerCreator(
    {
      wallet: " 0xabc ",
      name: " Builder Name ",
      bio: " sells guides ",
      apiUrl: "https://agentmart.dev",
    },
    {
      resolvePrivateKey: async () => "0xprivate",
      privateKeyToAccount: (privateKey) => {
        calls.privateKeyToAccount.push(privateKey);
        return { address: "0xabc", privateKey };
      },
      fetchImpl: async () => {
        throw new Error("raw fetch should be wrapped before use");
      },
      wrapFetchWithPayment: (fetchImpl, options) => {
        calls.wrapFetchWithPayment.push({ fetchImpl, options });
        return async (url, init) => {
          calls.paidFetch.push({ url: String(url), init });
          return new Response(JSON.stringify({ apiKey: "api_123" }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        };
      },
      x402ClientCtor: FakeX402Client,
      exactEvmSchemeCtor: FakeExactEvmScheme,
    },
  );

  assert.equal(result.apiKey, "api_123");
  assert.deepEqual(calls.privateKeyToAccount, ["0xprivate"]);
  assert.equal(calls.wrapFetchWithPayment.length, 1);
  assert.equal(typeof calls.wrapFetchWithPayment[0].options.register, "function");
  assert.deepEqual(
    calls.wrapFetchWithPayment[0].options.registerCalls.map(({ network }) => network),
    ["base", "eip155:8453", "eip155:*"],
  );
  assert.equal(calls.paidFetch.length, 1);
  assert.equal(calls.paidFetch[0].url, "https://agentmart.dev/api/register");
  assert.equal(calls.paidFetch[0].init.method, "POST");
  assert.deepEqual(calls.paidFetch[0].init.headers, {
    "content-type": "application/json",
  });
  assert.deepEqual(JSON.parse(calls.paidFetch[0].init.body), {
    wallet: "0xabc",
    displayName: "Builder Name",
    bio: "sells guides",
  });
});

test("registerCreator uses Base Sepolia when --testnet is set", async () => {
  const calls = { wrapFetchWithPayment: [] };

  await registerCreator(
    { wallet: "0xabc", name: "Builder", bio: "bio", testnet: true },
    {
      resolvePrivateKey: async () => "0xprivate",
      privateKeyToAccount: () => ({ address: "0xabc" }),
      fetchImpl: async () => {},
      wrapFetchWithPayment: (_fetchImpl, options) => {
        calls.wrapFetchWithPayment.push(options);
        return async () =>
          new Response(JSON.stringify({ apiKey: "api_123" }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
      },
      x402ClientCtor: FakeX402Client,
      exactEvmSchemeCtor: FakeExactEvmScheme,
    },
  );

  assert.deepEqual(
    calls.wrapFetchWithPayment[0].registerCalls.map(({ network }) => network),
    ["base-sepolia", "eip155:84532", "eip155:*"],
  );
});

test("registerCreator fails when private key is missing", async () => {
  await assert.rejects(
    registerCreator(
      { wallet: "0xabc", name: "Builder", bio: "bio" },
      { resolvePrivateKey: async () => undefined },
    ),
    /Missing private key/,
  );
});

test("registerCreator surfaces API errors", async () => {
  await assert.rejects(
    registerCreator(
      { wallet: "0xabc", name: "Builder", bio: "bio" },
      {
        resolvePrivateKey: async () => "0xprivate",
        privateKeyToAccount: () => ({ address: "0xabc" }),
        fetchImpl: async () => {},
        wrapFetchWithPayment: () => {
          return async () =>
            new Response(JSON.stringify({ error: "already exists" }), {
              status: 409,
              headers: { "content-type": "application/json" },
            });
        },
      },
    ),
    /Registration failed \(409\): already exists/,
  );
});

test("createRegisterAction logs returned API key", async () => {
  const logs = [];
  const savedApiKeys = [];
  const action = createRegisterAction({
    logger: { log: (line) => logs.push(line) },
    setApiKey: async (apiKey) => {
      savedApiKeys.push(apiKey);
    },
    resolvePrivateKey: async () => "0xprivate",
    privateKeyToAccount: () => ({ address: "0xabc" }),
    fetchImpl: async () => {},
    wrapFetchWithPayment: () => {
      return async () =>
        new Response(JSON.stringify({ apiKey: "api_789" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
    },
  });

  await action({ wallet: "0xabc", name: "Builder", bio: "bio" });
  assert.deepEqual(logs, ["API key: api_789"]);
  assert.deepEqual(savedApiKeys, ["api_789"]);
});
