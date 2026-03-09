import assert from "node:assert/strict";
import test from "node:test";

import { createX402PaymentClient } from "./bin/payment-client.js";

class FakeExactEvmScheme {
  constructor(account) {
    this.account = account;
  }
}

class FakeExactEvmSchemeV1 {
  constructor(account) {
    this.account = account;
  }
}

class FakeX402Client {
  constructor() {
    this.registerCalls = [];
    this.registerV1Calls = [];
  }

  register(network, scheme) {
    this.registerCalls.push({ network, scheme });
    return this;
  }

  registerV1(network, scheme) {
    this.registerV1Calls.push({ network, scheme });
    return this;
  }
}

test("createX402PaymentClient registers the network, CAIP alias, wildcard, and V1 scheme", async () => {
  const account = { address: "0xabc" };
  const client = await createX402PaymentClient({
    account,
    network: "base-sepolia",
    x402ClientCtor: FakeX402Client,
    exactEvmSchemeCtor: FakeExactEvmScheme,
    exactEvmSchemeV1Ctor: FakeExactEvmSchemeV1,
  });

  assert.equal(client instanceof FakeX402Client, true);
  assert.deepEqual(
    client.registerCalls.map(({ network }) => network),
    ["base-sepolia", "eip155:84532", "eip155:*"],
  );
  assert.deepEqual(
    client.registerV1Calls.map(({ network }) => network),
    ["base-sepolia"],
  );
  assert.equal(client.registerCalls[0].scheme.account, account);
  assert.equal(client.registerV1Calls[0].scheme.account, account);
});

test("createX402PaymentClient skips CAIP duplicate registration and V1 registration for unknown networks", async () => {
  const client = await createX402PaymentClient({
    account: { address: "0xabc" },
    network: "eip155:1",
    x402ClientCtor: FakeX402Client,
    exactEvmSchemeCtor: FakeExactEvmScheme,
    exactEvmSchemeV1Ctor: FakeExactEvmSchemeV1,
  });

  assert.deepEqual(
    client.registerCalls.map(({ network }) => network),
    ["eip155:1", "eip155:*"],
  );
  assert.deepEqual(client.registerV1Calls, []);
});
