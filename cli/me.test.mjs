import assert from "node:assert/strict";
import test from "node:test";

import { createMeAction, getCurrentCreator } from "./bin/me.js";

test("getCurrentCreator reads profile from /api/me using stored api key", async () => {
  const calls = [];
  const profile = await getCurrentCreator(
    { apiUrl: "https://agentmart.dev" },
    {
      env: {},
      fsModule: {
        readFile: async () => JSON.stringify({ apiKey: "stored_key" }),
      },
      configFilePath: "/tmp/agentmart-config.json",
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), init });
        return new Response(
          JSON.stringify({ wallet: "0xabc", displayName: "Builder" }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      },
    },
  );

  assert.deepEqual(profile, { wallet: "0xabc", name: "Builder" });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://agentmart.dev/api/me");
  assert.equal(calls[0].init.method, "GET");
  assert.equal(calls[0].init.headers.authorization, "Bearer stored_key");
});

test("getCurrentCreator fails when API key is missing", async () => {
  await assert.rejects(
    getCurrentCreator(
      {},
      {
        env: {},
        fsModule: {
          readFile: async () => {
            const error = new Error("missing");
            error.code = "ENOENT";
            throw error;
          },
        },
        configFilePath: "/tmp/agentmart-config.json",
      },
    ),
    /Missing API key/,
  );
});

test("getCurrentCreator surfaces API errors", async () => {
  await assert.rejects(
    getCurrentCreator(
      {},
      {
        env: { AGENTMART_API_URL: "https://agentmart.dev" },
        fsModule: { readFile: async () => JSON.stringify({ apiKey: "key_1" }) },
        configFilePath: "/tmp/agentmart-config.json",
        fetchImpl: async () =>
          new Response(JSON.stringify({ error: "Invalid API key" }), {
            status: 401,
            headers: { "content-type": "application/json" },
          }),
      },
    ),
    /Failed to load profile \(401\): Invalid API key/,
  );
});

test("createMeAction logs wallet and name", async () => {
  const logs = [];
  const action = createMeAction({
    logger: { log: (line) => logs.push(line) },
    env: { AGENTMART_API_URL: "https://agentmart.dev" },
    fsModule: { readFile: async () => JSON.stringify({ apiKey: "key_2" }) },
    configFilePath: "/tmp/agentmart-config.json",
    fetchImpl: async () =>
      new Response(JSON.stringify({ wallet: "0xdef", displayName: "Alice" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
  });

  await action({});
  assert.deepEqual(logs, ["Wallet: 0xdef", "Name: Alice"]);
});
