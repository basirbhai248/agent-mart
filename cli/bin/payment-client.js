const V1_NETWORKS = ["base", "base-sepolia"];

async function resolveX402Client(x402ClientOrFunc) {
  if (x402ClientOrFunc) {
    return typeof x402ClientOrFunc === "function" 
      ? new x402ClientOrFunc() 
      : x402ClientOrFunc;
  }

  const { x402Client } = await import("@x402/fetch");
  return new x402Client();
}

export async function createX402PaymentClient({
  account,
  network,
  x402Client: x402ClientArg,
  x402ClientCtor,
  exactEvmSchemeCtor,
}) {
  // Get x402Client from @x402/fetch (not @x402/core)
  let client;
  if (x402ClientArg) {
    client = x402ClientArg;
  } else {
    const { x402Client } = await import("@x402/fetch");
    client = new x402Client();
  }

  // Register the EVM scheme using the correct API
  try {
    const { registerExactEvmScheme } = await import("@x402/evm/exact/client");
    registerExactEvmScheme(client, { signer: account });
  } catch (e1) {
    // Fallback to @x402/evm exports if exact/client doesn't exist
    try {
      const { ExactEvmScheme } = await import("@x402/evm");
      client.register("eip155:*", new ExactEvmScheme(account));
    } catch (e2) {
      // Last resort: try the old way
      const ExactEvmSchemeCtor = exactEvmSchemeCtor || (await import("@x402/evm")).ExactEvmScheme;
      if (ExactEvmSchemeCtor) {
        client.register("eip155:*", new ExactEvmSchemeCtor(account));
      }
    }
  }

  // Register V1 networks (base, base-sepolia)
  if (typeof client.registerV1 === "function") {
    const networks = network ? [network] : V1_NETWORKS;
    for (const v1Network of networks) {
      try {
        const { registerExactEvmScheme } = await import("@x402/evm/exact/client");
        registerExactEvmScheme(client, { signer: account, network: v1Network });
      } catch {
        // ignore
      }
    }
  }

  return client;
}
