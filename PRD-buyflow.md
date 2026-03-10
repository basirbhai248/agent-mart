# PRD: Fix Agent Mart Buy Flow (Base Mainnet)

## Context
Agent Mart is a CLI marketplace where AI agents buy/sell content using X402 payments (USDC on Base).
The server is deployed on Vercel at https://agent-mart-beryl.vercel.app.
The buy flow is broken — the CLI crashes when trying to purchase content.

## Environment
- **Wallet private key:** `REDACTED_PRIVATE_KEY`
- **Wallet address:** `0x74D2fE82cBe3675Dc97494D587af2E46EA9a83Bb`
- **Network:** Base mainnet (eip155:8453)
- **Platform wallet (set on Vercel):** `0x94f6698e49875ac79cc5a7f459799418cc72cf74`
- **USDC contract on Base:** `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- **API URL:** https://agent-mart-beryl.vercel.app
- The wallet has been funded with ETH (for gas) and USDC on Base mainnet.

## Known Issues from Previous Debug Session
1. CLI had a "Body has already been read" error — this was fixed by using `response.clone().text()` in debug path
2. Server was returning `destinationWallet: null` in the JSON body — this was fixed by adding PLATFORM_WALLET_ADDRESS to Vercel env
3. The X402 payment client creation may still have issues with scheme registration

## Tasks
- [x] Read the current buy flow code in `cli/bin/buy.js` and `cli/bin/payment-client.js` to understand the current state
- [x] Read the server-side content endpoint in `app/api/listings/[id]/content/route.js` to understand the 402 response format
- [x] Identify and fix any remaining bugs in the buy flow (client-side or server-side)
- [x] Test the buy flow end-to-end on Base mainnet: first register a test agent, upload a test listing, then buy it using the funded wallet
- [x] Verify the purchase completes successfully and content is returned

## Test Commands
```bash
# Register a test agent
cd ~/projects/agent-mart && node cli/index.js register --name test-buyer --api-url https://agent-mart-beryl.vercel.app

# List available listings
node cli/index.js list --api-url https://agent-mart-beryl.vercel.app

# Upload a test listing (if none exist)
node cli/index.js upload --title "Test Item" --content "Hello world test content" --price 0.01 --api-url https://agent-mart-beryl.vercel.app

# Buy a listing (use actual listing ID from list output)
AGENT_MART_PRIVATE_KEY=REDACTED_PRIVATE_KEY \
node cli/index.js buy --id <LISTING_ID> --network base --api-url https://agent-mart-beryl.vercel.app
```

## Important Notes
- This is Base MAINNET with real funds. Be careful with transaction amounts.
- Test with the cheapest listing available (or create one at $0.01).
- The private key above is for a test wallet, not a production wallet.
- Do NOT modify environment variables on Vercel — they are already set correctly.
