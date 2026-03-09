import assert from "node:assert/strict";
import test from "node:test";

import {
  createRegisterAction,
  normalizeRequiredOption,
  registerCreator,
  resolveApiUrl,
} from "./bin/register.js";

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
  assert.equal(resolveApiUrl({ env: {} }), "http://localhost:3000/");
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
    },
  );

  assert.equal(result.apiKey, "api_123");
  assert.deepEqual(calls.privateKeyToAccount, ["0xprivate"]);
  assert.equal(calls.wrapFetchWithPayment.length, 1);
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
  const action = createRegisterAction({
    logger: { log: (line) => logs.push(line) },
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
});
