# Fix Buy Command — X402 Client

## Bug
`agentmart buy` fails with: `client.createPaymentPayload is not a function`

The `wrapFetchWithPayment` function from `@x402/fetch` expects the second argument to be an `x402Client` instance (from `@x402/core/client`), NOT a plain object like `{ account, network }`.

## Fix
In cli/bin/buy.js, the `buildPaymentFetch` function needs to create a proper `x402Client` instance. Check the @x402/core source at cli/node_modules/@x402/core/dist/ to see how to create an x402Client. It likely requires:

```js
import { x402Client } from "@x402/core/client";
import { evmPaymentScheme } from "@x402/evm";

const client = new x402Client({
  paymentSchemes: [evmPaymentScheme({ account, chain: baseSepolia })],
});
```

Or similar. Read the source to figure out the exact API.

## Tasks

- [ ] Read @x402/core/client source (cli/node_modules/@x402/core/dist/) to understand how to create an x402Client with createPaymentPayload support
- [ ] Read @x402/evm source (cli/node_modules/@x402/evm/dist/) to understand how to create an EVM payment scheme  
- [ ] Fix cli/bin/buy.js buildPaymentFetch to create a proper x402Client instance instead of passing a plain object
- [ ] Test: `EVM_PRIVATE_KEY=REDACTED_PRIVATE_KEY AGENTMART_TESTNET=true node cli/bin/agentmart.js buy j97e7edqcdp31zqdp1v1ddyv6x82k6we` should NOT throw "createPaymentPayload is not a function"
- [ ] Run `npm run build` to verify no build errors
