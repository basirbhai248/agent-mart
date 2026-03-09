import assert from "node:assert/strict";
import test from "node:test";

import { createRecoverAction, recoverCreator } from "./bin/recover.js";

test("recoverCreator posts /api/recover and returns api key", async () => {
  const calls = [];

  const result = await recoverCreator(
    {
      wallet: " 0xabc ",
      signature: " 0xsig ",
      apiUrl: "https://agentmart.dev",
    },
    {
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), init });
        return new Response(JSON.stringify({ apiKey: "api_123" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    },
  );

  assert.equal(result.apiKey, "api_123");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://agentmart.dev/api/recover");
  assert.equal(calls[0].init.method, "POST");
  assert.deepEqual(calls[0].init.headers, {
    "content-type": "application/json",
  });
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    wallet: "0xabc",
    signature: "0xsig",
  });
});

test("recoverCreator validates required options", async () => {
  await assert.rejects(recoverCreator({ signature: "0xsig" }), /--wallet is required/);
  await assert.rejects(
    recoverCreator({ wallet: "0xabc", signature: "   " }),
    /--signature is required/,
  );
});

test("recoverCreator surfaces API errors", async () => {
  await assert.rejects(
    recoverCreator(
      { wallet: "0xabc", signature: "0xsig" },
      {
        fetchImpl: async () =>
          new Response(JSON.stringify({ error: "invalid signature" }), {
            status: 401,
            headers: { "content-type": "application/json" },
          }),
      },
    ),
    /Recovery failed \(401\): invalid signature/,
  );
});

test("createRecoverAction logs returned API key", async () => {
  const logs = [];
  const savedApiKeys = [];
  const action = createRecoverAction({
    logger: { log: (line) => logs.push(line) },
    setApiKey: async (apiKey) => {
      savedApiKeys.push(apiKey);
    },
    fetchImpl: async () =>
      new Response(JSON.stringify({ apiKey: "api_789" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
  });

  await action({ wallet: "0xabc", signature: "0xsig" });
  assert.deepEqual(logs, ["API key: api_789"]);
  assert.deepEqual(savedApiKeys, ["api_789"]);
});
