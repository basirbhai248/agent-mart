# Testnet Setup for Agent Mart

## Context
Agent Mart uses X402 payments on Base. We need a testnet version so we can test the full e2e flow (register, upload, search, buy) without real money.

## Tasks

- [x] Configure the app to support Base Sepolia testnet. Add an environment variable `NEXT_PUBLIC_NETWORK=testnet` that switches between mainnet and testnet. When testnet: use Base Sepolia chain, use the x402 testnet facilitator (https://x402.org/facilitator if it supports testnet, otherwise mock the payment verification).
- [x] Update convex/http.ts to accept a testnet flag or header that skips real X402 payment verification and instead accepts any valid-looking payment payload for testing purposes. Guard this behind an env var `CONVEX_TESTNET=true`.
- [x] Update the CLI to support a `--testnet` flag on register and buy commands that uses Base Sepolia instead of Base mainnet. The CLI should detect `AGENTMART_TESTNET=true` env var as well.
- [x] Create a test script at scripts/e2e-test.sh that runs the full flow: register a creator (with a test wallet), upload a test markdown file, search for it, and buy it. Use a hardcoded test private key for Base Sepolia.
- [x] Run the e2e test script and verify it completes successfully end to end
- [x] Document the testnet setup in a TESTING.md file at the project root
