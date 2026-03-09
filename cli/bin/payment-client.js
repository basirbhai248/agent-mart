const NETWORK_CAIP_IDS = {
  base: "eip155:8453",
  "base-sepolia": "eip155:84532",
};

async function resolveX402Client(x402ClientArg, x402ClientCtor) {
  if (x402ClientArg) {
    return x402ClientArg;
  }

  if (x402ClientCtor) {
    return new x402ClientCtor();
  }

  const { x402Client } = await import("@x402/fetch");
  return new x402Client();
}

async function resolveExactEvmSchemeCtor(exactEvmSchemeCtor) {
  if (exactEvmSchemeCtor) {
    return exactEvmSchemeCtor;
  }

  const { ExactEvmScheme } = await import("@x402/evm");
  return ExactEvmScheme;
}

async function resolveExactEvmSchemeV1Ctor(exactEvmSchemeV1Ctor) {
  if (exactEvmSchemeV1Ctor) {
    return exactEvmSchemeV1Ctor;
  }

  const { ExactEvmSchemeV1 } = await import("@x402/evm/v1");
  return ExactEvmSchemeV1;
}

export async function createX402PaymentClient({
  account,
  network,
  x402Client: x402ClientArg,
  x402ClientCtor,
  exactEvmSchemeCtor,
  exactEvmSchemeV1Ctor,
}) {
  const client = await resolveX402Client(x402ClientArg, x402ClientCtor);
  const ExactEvmScheme = await resolveExactEvmSchemeCtor(exactEvmSchemeCtor);
  const scheme = new ExactEvmScheme(account);
  const caipNetwork = NETWORK_CAIP_IDS[network] ?? network;

  client.register(network, scheme);
  if (caipNetwork !== network) {
    client.register(caipNetwork, scheme);
  }
  client.register("eip155:*", scheme);

  if (typeof client.registerV1 === "function" && network in NETWORK_CAIP_IDS) {
    const ExactEvmSchemeV1 = await resolveExactEvmSchemeV1Ctor(exactEvmSchemeV1Ctor);
    client.registerV1(network, new ExactEvmSchemeV1(account));
  }

  return client;
}
