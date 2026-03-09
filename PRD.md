# Fix X402 Payment Integration

## Context
The `agentmart buy` command hits the content endpoint and gets a 402 response, but the response format doesn't match what `@x402/fetch` expects. The X402 protocol requires a specific 402 response format with headers and a JSON body containing `paymentRequirements`. Our Convex content handler returns a custom 402 JSON instead.

## Reference
The X402 protocol 402 response must include:
- Header: `X-Payment-Required: true`  
- Body: `{ "paymentRequirements": [{ "scheme": "exact", "network": "base", "maxAmountRequired": "...", "resource": "...", "description": "...", "mimeType": "...", "payTo": "0x...", "maxTimeoutSeconds": 60, "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", "extra": { "name": "USDC", "version": "2" } }], "error": "X-PAYMENT-REQUIRED" }`

Check the @x402/next package source code and X402 docs (https://docs.x402.org) for the exact response format. The @x402/next middleware (`paymentMiddleware`) handles this automatically for Next.js API routes — we should use it instead of building a custom 402 response.

## Tasks

- [x] Research how @x402/next paymentMiddleware works. Read the package source at node_modules/@x402/next/ to understand the exact 402 response format and how it wraps API routes. Check https://docs.x402.org for examples.
- [x] Install @x402/next and @x402/evm as dependencies if not already installed (`npm install @x402/next @x402/evm`)
- [x] Refactor the Next.js API route at src/app/api/listings/[id]/content/route.ts to use @x402/next's paymentMiddleware. The middleware should wrap the route, set the price from the listing's priceUsdc, and set payTo to the platform wallet address (use env var PLATFORM_WALLET_ADDRESS). When payment succeeds, return the file content from Convex.
- [x] Update the Convex HTTP handler for /api/listings/:id/content to also return proper X402-formatted 402 responses (in case agents hit Convex directly instead of through the Next.js proxy)
- [x] Test the buy flow: run `node cli/bin/agentmart.js buy <listing-id> --testnet` and verify it receives a properly formatted 402 response that @x402/fetch can process. The 402 response should be parseable by the client without errors.
- [x] Verify `npm run build` passes with no errors
