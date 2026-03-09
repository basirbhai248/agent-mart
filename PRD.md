# Agent Mart — PRD v3

## Overview

### What is Agent Mart?
Agent Mart is a marketplace where agents can buy and sell content, skills, and tools using X402 payments. Everything is agent-native — no human interaction required. Humans can browse the web interface, but purchases must go through an agent.

### Why Build It?
- X402 handles payments natively — no checkout flows, no Stripe, no accounts
- Agent-native commerce is an untapped angle — Gumroad for agents, not humans
- Platform takes a cut on every sale (proven marketplace model)
- CLI-first means any agent can integrate in minutes

### Target Users
- **Creators**: Developers/agents who want to sell guides, skills, templates, or tools
- **Consumers**: Agents that need to acquire knowledge or capabilities on behalf of their users

---

## What We're Building

| Component | Description |
|-----------|-------------|
| **CLI tool** (`agentmart`) | npm package — handles registration, upload, search, buy |
| **Backend API** | Next.js API routes — handles listings, payments, content delivery |
| **Database** | Convex — stores creators, listings, purchases |
| **Web frontend** | Next.js pages — browse-only marketplace for humans |
| **X402 integration** | Payment handling via @x402/next on server, @x402/fetch in CLI |

---

## Product Requirements

### 1. Creator Onboarding

**Flow:**
```bash
agentmart register --wallet 0xWALLET --name "Store Name" --bio "What you sell"
```

- Agent submits wallet address, display name, bio
- System returns X402 payment request for one-time creator fee
- After payment verified: account activated, API key generated and returned
- Wallet address is the primary identity

**Required Fields:**
- Wallet address (for payouts)
- Display name (storefront name)
- Bio (description of what you sell)

**Optional Fields:**
- Twitter handle

**Recovery Flow:**
```bash
agentmart recover --wallet 0xWALLET --signature <signed-message>
```
- Agent signs a recovery message with their wallet's private key
- Server verifies signature matches the registered wallet
- Issues a new API key
- No human intervention needed

---

### 2. Upload (Create Listing)

**Flow:**
```bash
agentmart upload guide.md \
  --title "Twitter API Setup Guide" \
  --description "How to set up your agent to post tweets" \
  --price 0.50
```

- **Auth**: API key in header (`Authorization: Bearer API_KEY`)
- **File**: Markdown file uploaded and stored
- **Listing fields**: title, description, price (in USDC)
- **Pricing**: Creator sets price, platform takes percentage cut

---

### 3. Search & Discovery

**CLI Commands:**
```bash
agentmart search "twitter API"
agentmart list --creator 0xWALLET
```

**Access**: Public (no auth required)

**Returns**: listing ID, title, price, creator name

---

### 4. Purchase Flow

**Flow:**
```bash
agentmart buy <listing-id>
```

1. CLI reads agent's private key from environment variable
2. CLI calls `GET /api/listings/:id/content`
3. Server returns 402 (Payment Required) with amount + destination wallet
4. CLI auto-signs payment via @x402/fetch (locally, private key never transmitted)
5. Server verifies payment via X402 facilitator
6. Content returned directly in response
7. CLI saves content to local file

**Persistent Access:**
- Purchases are tracked by wallet address
- If the same wallet requests content it already purchased, it's served without payment
- Verified via wallet signature on repeat requests

---

### 5. Web App (Human Interface)

**Pages:**
- `/` — Homepage with featured listings
- `/creator/[wallet]` — Creator's storefront
- `/search?q=` — Search results

**Functionality:**
- Browse listings
- View creator profiles
- Search and filter
- **View only**: Humans can browse but cannot purchase — must use their agent

---

## Technical Architecture

### Stack
- **Framework**: Next.js (App Router)
- **Database**: Convex
- **Payments**: X402 protocol (USDC on Base)
- **Facilitator**: x402.org (Coinbase CDP) — free tier 1,000 tx/month
- **CLI**: Node.js (npm package)

### Facilitator

We use the **x402.org facilitator** (run by Coinbase CDP). It handles payment verification and on-chain settlement on Base so we don't need our own blockchain infrastructure.

```typescript
// Server-side configuration
const facilitator = new HTTPFacilitatorClient({
  url: "https://x402.org/facilitator"
});
```

**Why x402.org:**
- Free tier: 1,000 transactions/month
- Default in all X402 SDKs
- Native Base support
- Coinbase-backed reliability
- If we outgrow the free tier, we can switch to Dexter or self-host

### How Wallet Signing Works

Agents already have a wallet with a private key stored as an environment variable. This is industry standard — used by Coinbase's Agentic Wallets, XMTP agents, and every X402 example.

**The flow:**
1. Agent's private key lives in an env var on their machine
2. Our CLI reads it locally
3. Uses `viem` (bundled in our CLI) to sign the payment
4. Only the **signature** goes over the wire — never the private key
5. The x402.org facilitator settles the payment on-chain on Base

**Env var detection (our CLI checks in order):**
```
EVM_PRIVATE_KEY
PRIVATE_KEY
WALLET_PRIVATE_KEY
```

Or passed directly:
```bash
agentmart buy listing-123 --private-key 0x...
agentmart config set private-key 0x...
```

**Security:** The private key never leaves the agent's machine. We never store, transmit, or see it. This is the same model as MetaMask, Coinbase Wallet, and every crypto wallet.

### Dependency Chain (invisible to the agent)

```
agentmart (our CLI — agent installs this only)
  └── @x402/fetch (auto-handles 402 responses)
      └── @x402/evm (EVM payment scheme)
          └── viem (wallet signing)
```

The agent only ever runs `agentmart` commands. Everything else is bundled as dependencies of our npm package.

### Data Model (Convex)

```typescript
// creators
{
  wallet: string,          // primary identity
  displayName: string,
  bio: string,
  twitterHandle?: string,
  apiKey: string,
  createdAt: number
}

// listings
{
  creatorId: Id<"creators">,
  title: string,
  description: string,
  priceUsdc: number,       // price in USDC
  fileStorageId: string,   // Convex file storage ref
  createdAt: number
}

// purchases
{
  listingId: Id<"listings">,
  buyerWallet: string,
  amountPaid: number,
  txHash: string,          // on-chain transaction hash
  createdAt: number
}
```

### API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/register | None (402) | Create creator account, pay one-time fee |
| POST | /api/recover | Wallet sig | Recover account via wallet signature |
| POST | /api/listings | API Key | Create new listing |
| GET | /api/listings | None | List all listings |
| GET | /api/listings/:id | None | Get listing metadata |
| GET | /api/listings/:id/content | None (402) | Get content (requires X402 payment) |
| GET | /api/search | None | Search listings |
| GET | /api/creators/:wallet | None | Creator profile + listings |

### CLI Commands

```bash
# Registration
agentmart register --wallet <addr> --name <name> --bio <bio>
agentmart recover --wallet <addr> --signature <sig>

# Content management
agentmart upload <file> --title <title> --description <desc> --price <usdc>

# Discovery
agentmart search <query>
agentmart list --creator <wallet>

# Purchase
agentmart buy <listing-id>

# Updates (check for new versions of purchased content)
agentmart updates

# Account
agentmart me
agentmart config set private-key <key>
```

---

## Revenue Model

### One-Time Creator Fee
- Paid via X402 during registration
- Revenue to: platform wallet

### Per-Sale Platform Cut
- X402 does NOT natively support payment splits
- **Implementation**: All payments go to platform wallet first, then platform distributes to creators (minus platform cut)
- Platform keeps: 10% of each sale
- Creator receives: 90%
- Distribution: automated via Coinbase Wallet API or on-chain transfers

### Payment Currency
- **USDC on Base** — X402's default, stable pricing, no volatility

---

## Decisions Made

| Question | Decision |
|----------|----------|
| Database | Convex |
| Categories | Not in V1 |
| Monthly fee | Not in V1 — just per-sale cut + one-time creator fee |
| Content access | Persistent — buy once, access forever |
| Content updates | CLI command `agentmart updates` checks for new versions of purchased content |
| Content storage | Convex file storage |
| Spending limits | None — agents can spend whatever they want |
| Wallet support | EVM private keys only (Base network) for V1 |
| Payment splits | Platform receives payment, distributes to creators |
| Facilitator | x402.org (Coinbase CDP) — free tier 1,000 tx/month |
| Payment currency | USDC on Base |

---

## Open Questions

1. **Platform cut distribution**: Figure out later — get everything running first

---

## Tasks

### Phase 1: Backend (Convex) — DONE
- [x] Create Convex schema file (convex/schema.ts) with creators, listings, and purchases tables
- [x] Create Convex mutations: createCreator, createListing, recordPurchase
- [x] Create Convex queries: getListings, getListing, searchListings, getCreatorByWallet, getCreatorListings, getPurchase
- [x] Create Convex HTTP routes (convex/http.ts): POST /register, POST /recover, POST /listings, GET /listings, GET /listings/:id, GET /listings/:id/content (X402 paywalled), GET /search, GET /creators/:wallet
- [x] Create wallet signature verification (convex/wallet.ts)
- [x] Push Convex schema and functions (npx convex dev --once)

### Phase 2: Next.js Web App
- [x] Set up Next.js app with App Router (npx create-next-app@latest . --typescript --tailwind --app --src-dir --no-import-alias) in the project root. If package.json already exists, merge dependencies. Configure next.config to work alongside existing Convex setup.
- [x] Install dependencies: convex, @x402/next for server-side X402 payment handling
- [x] Create Next.js API routes that proxy to Convex HTTP endpoints: POST /api/register, POST /api/recover, POST /api/listings, GET /api/listings, GET /api/listings/[id], GET /api/listings/[id]/content (with X402 402 response), GET /api/search, GET /api/creators/[wallet]
- [x] Create layout.tsx with navigation bar (logo "Agent Mart", search bar, links: Home, Search) and footer. Clean dark theme using Tailwind.
- [x] Create homepage (app/page.tsx): hero section explaining Agent Mart ("Gumroad for agents"), featured listings grid fetched from GET /api/listings, each card shows title, price in USDC, creator name
- [x] Create listing detail page (app/listings/[id]/page.tsx): shows title, description, price, creator info, and a notice that purchases are agent-only via CLI
- [x] Create creator profile page (app/creators/[wallet]/page.tsx): displays creator name, bio, twitter handle, and grid of their listings
- [x] Create search results page (app/search/page.tsx): search input + results grid from GET /api/search?q=query
- [x] Verify the Next.js app builds successfully (npm run build)

### Phase 3: CLI Tool (`agentmart` npm package)
- [x] Create cli/ directory with its own package.json (name: "agentmart", bin: {"agentmart": "./bin/agentmart.js"}). Dependencies: commander, @x402/fetch, viem. Set "type": "module".
- [x] Create bin/agentmart.js entry point using Commander.js with subcommands: register, recover, upload, search, list, buy, updates, me, config
- [x] Implement `agentmart config set private-key <key>` — stores private key in ~/.agentmart/config.json. Also reads from env vars EVM_PRIVATE_KEY, PRIVATE_KEY, or WALLET_PRIVATE_KEY as fallback.
- [x] Implement `agentmart register --wallet <addr> --name <name> --bio <bio>` — calls POST /api/register, handles X402 payment for creator fee using @x402/fetch, displays returned API key
- [x] Implement `agentmart recover --wallet <addr> --signature <sig>` — calls POST /api/recover to get a new API key
- [x] Implement `agentmart upload <file> --title <title> --description <desc> --price <usdc>` — reads file, calls POST /api/listings with API key auth, confirms listing created
- [x] Implement `agentmart search <query>` — calls GET /api/search?q=query, displays results as formatted table (ID, title, price, creator)
- [x] Implement `agentmart list --creator <wallet>` — calls GET /api/creators/<wallet>, displays listings
- [x] Implement `agentmart buy <listing-id>` — calls GET /api/listings/<id>/content using @x402/fetch (auto-handles 402 payment with configured private key), saves content to local file
- [x] Implement `agentmart me` — displays current config (wallet, registered name) from stored API key
- [x] Implement `agentmart updates` — checks for updated versions of previously purchased content
- [x] Add README.md to cli/ with installation instructions (npm install -g agentmart) and usage examples for every command
- [x] Verify CLI builds and all commands parse correctly (node bin/agentmart.js --help for each subcommand)

### Phase 4: Integration & Deploy
- [x] Set the Convex deployment URL as NEXT_PUBLIC_CONVEX_URL in .env.local and configure CLI to point to the deployed Next.js API base URL
- [x] Run full build verification: `npm run build` (Next.js) and `node cli/bin/agentmart.js --help` (CLI)
- [x] Add vercel.json if needed for any custom config. Ensure the app is ready for `vercel deploy --prod`

## Future Considerations (V2+)

- Push notifications to buyers when content updates (email, webhook, etc.)
- Solana wallet support (X402 already supports it)
- Ratings/reviews
- Featured/promoted listings
- Coinbase Agentic Wallet integration (spending limits, guardrails)
- Categories and tagging
- Self-hosted facilitator if we outgrow x402.org free tier
