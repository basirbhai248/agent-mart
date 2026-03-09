# Fix Remaining Bugs — Agent Mart

## Bug 1: Search JSON Truncation
The CLI search command gets back truncated JSON from the Convex HTTP proxy, causing `SyntaxError: Unterminated string in JSON`. The response body is being cut off. This is likely a buffering issue in how the Convex HTTP handler streams the response, or the response body is too large for a single chunk.

Fix: In convex/http.ts, ensure the search endpoint returns the full JSON body. Use `new Response(JSON.stringify(results), { headers: { "Content-Type": "application/json" } })` and make sure the response isn't being chunked or truncated. Also check the CLI search.js to ensure it reads the full response body before parsing.

## Bug 2: X402 Buy Flow — Invalid Payment Required Response
The `agentmart buy` command hits the content endpoint and gets a 402, but `@x402/fetch` throws "Failed to parse payment requirements: Invalid payment required response". 

The 402 response MUST match the exact format that @x402/fetch expects. Check the @x402/fetch source code at node_modules/@x402/fetch/dist/ to see exactly what format it parses. The response needs specific headers and body structure matching the X402 protocol spec.

Look at how @x402/next's `paymentMiddleware` generates 402 responses — our content endpoint should return the exact same format. If @x402/next is already installed, USE the middleware directly on the Next.js API route instead of manually crafting the 402 response.

## Tasks

- [ ] Fix the search JSON truncation: ensure convex/http.ts search handler returns complete JSON responses. Test with `curl https://flippant-gecko-520.convex.site/api/search?q=twitter | python3 -m json.tool` to verify valid JSON.
- [ ] Fix the CLI search.js to properly handle the response — ensure it reads the full body before JSON.parse.
- [ ] Read the @x402/fetch source code (node_modules/@x402/fetch/dist/) to understand exactly what 402 response format it expects (headers, body schema, required fields).
- [ ] Read the @x402/next source code (node_modules/@x402/next/dist/) to see how paymentMiddleware generates 402 responses.
- [ ] Fix src/app/api/listings/[id]/content/route.ts to use @x402/next paymentMiddleware correctly, OR manually return a 402 response that exactly matches what @x402/fetch parses.
- [ ] Test search: `node cli/bin/agentmart.js search "Twitter"` should return formatted results without errors.
- [ ] Test buy: `EVM_PRIVATE_KEY=REDACTED_PRIVATE_KEY AGENTMART_TESTNET=true node cli/bin/agentmart.js buy j97e7edqcdp31zqdp1v1ddyv6x82k6we` should either complete the purchase or fail with a payment error (NOT a parse error).
- [ ] Run `npm run build` to verify no build errors.
