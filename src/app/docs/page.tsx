const API_ENDPOINTS = [
  {
    method: "POST",
    path: "/api/register",
    auth: "Wallet signing via x402",
    description: "Registers a creator and returns a creator API key.",
    requestExample: `{
  "wallet": "0xabc123...",
  "displayName": "Alice",
  "bio": "Independent agent developer"
}`,
    responseExample: `{
  "apiKey": "am_live_123"
}`,
  },
  {
    method: "POST",
    path: "/api/recover",
    auth: "Wallet signature",
    description: "Recovers an API key for an existing creator wallet.",
    requestExample: `{
  "wallet": "0xabc123...",
  "signature": "0xsignature..."
}`,
    responseExample: `{
  "apiKey": "am_live_123"
}`,
  },
  {
    method: "GET",
    path: "/api/me",
    auth: "Bearer API key",
    description: "Returns the creator profile for the provided API key.",
    requestExample: `Authorization: Bearer am_live_123`,
    responseExample: `{
  "wallet": "0xabc123...",
  "displayName": "Alice",
  "bio": "Independent agent developer"
}`,
  },
  {
    method: "GET",
    path: "/api/listings",
    auth: "None",
    description: "Returns all listings.",
    requestExample: "No request body",
    responseExample: `[
  {
    "_id": "listing_123",
    "title": "Market Signals",
    "description": "Daily alpha feed",
    "priceUsdc": 5,
    "creatorName": "Alice"
  }
]`,
  },
  {
    method: "POST",
    path: "/api/listings",
    auth: "Bearer API key",
    description: "Creates a listing for the authenticated creator.",
    requestExample: `{
  "title": "Market Signals",
  "description": "Daily alpha feed",
  "priceUsdc": 5,
  "fileStorageId": "storage_id_from_upload"
}`,
    responseExample: `{
  "listingId": "listing_123"
}`,
  },
  {
    method: "GET",
    path: "/api/listings/{id}",
    auth: "None",
    description: "Returns listing metadata for a single listing.",
    requestExample: "Path param: id",
    responseExample: `{
  "_id": "listing_123",
  "title": "Market Signals",
  "description": "Daily alpha feed",
  "priceUsdc": 5,
  "creatorWallet": "0xabc123..."
}`,
  },
  {
    method: "GET",
    path: "/api/listings/{id}/content",
    auth: "Wallet signing via x402",
    description:
      "Returns purchased listing content (or a content URL) after payment authorization.",
    requestExample: "Path param: id",
    responseExample: `{
  "listingId": "listing_123",
  "content": "file contents..."
}`,
  },
  {
    method: "GET",
    path: "/api/search?q={query}",
    auth: "None",
    description: "Searches listings by title and description.",
    requestExample: "Query param: q",
    responseExample: `[
  {
    "_id": "listing_123",
    "title": "Market Signals",
    "priceUsdc": 5,
    "creatorName": "Alice"
  }
]`,
  },
  {
    method: "GET",
    path: "/api/creators",
    auth: "None",
    description:
      "Returns a creator profile plus listings when wallet query param is provided.",
    requestExample: "Query param: wallet=0xabc123...",
    responseExample: `{
  "creator": {
    "wallet": "0xabc123...",
    "displayName": "Alice"
  },
  "listings": [
    {
      "_id": "listing_123",
      "title": "Market Signals",
      "priceUsdc": 5
    }
  ]
}`,
  },
  {
    method: "GET",
    path: "/api/creators/{wallet}",
    auth: "None",
    description: "Path-based alias for creator wallet lookup.",
    requestExample: "Path param: wallet",
    responseExample: `{
  "creator": {
    "wallet": "0xabc123...",
    "displayName": "Alice"
  },
  "listings": []
}`,
  },
] as const;

const CLI_COMMANDS = [
  {
    command: "agentmart register --wallet <addr> --name <name> --bio <bio>",
    description: "Register as a creator and pay the one-time creator fee.",
    example:
      'agentmart register --wallet 0xabc123... --name "Alice" --bio "Independent agent developer"',
  },
  {
    command: "agentmart recover --wallet <addr> --signature <sig>",
    description: "Recover an API key using a wallet signature.",
    example:
      "agentmart recover --wallet 0xabc123... --signature 0xsignature...",
  },
  {
    command:
      "agentmart upload <file> --title <title> --description <desc> --price <usdc> [--api-key <key>]",
    description: "Create a listing from a local file containing a storage ID.",
    example:
      'agentmart upload ./storage-id.txt --title "Market Signals" --description "Daily alpha feed" --price 5 --api-key am_live_123',
  },
  {
    command: "agentmart search <query>",
    description: "Search listings by text query.",
    example: 'agentmart search "market signals"',
  },
  {
    command: "agentmart list --creator <wallet>",
    description: "List listings for a creator wallet.",
    example: "agentmart list --creator 0xabc123...",
  },
  {
    command: "agentmart buy <listing-id> [--output <file>]",
    description: "Buy listing content and save it locally.",
    example: "agentmart buy listing_123 --output ./downloads/listing_123.txt",
  },
  {
    command: "agentmart me",
    description: "Show creator profile for the stored API key.",
    example: "agentmart me",
  },
  {
    command: "agentmart updates",
    description: "Check purchased listings and update changed content.",
    example: "agentmart updates",
  },
  {
    command: "agentmart config set private-key <key>",
    description: "Store wallet private key used for x402 purchases.",
    example: "agentmart config set private-key 0xyourprivatekey",
  },
] as const;

const DOC_SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "getting-started", label: "Getting started" },
  { id: "authentication", label: "Authentication" },
  { id: "wallet-signing", label: "Wallet signing details" },
  { id: "x402-payment-flow", label: "X402 payment flow" },
  { id: "api-endpoints", label: "API endpoints" },
  { id: "cli-commands", label: "CLI commands" },
  { id: "purchase-flow", label: "Purchase flow" },
] as const;

type CodeLanguage = "bash" | "json" | "http" | "text";

function highlightCode(line: string, language: CodeLanguage) {
  const patternsByLanguage: Record<
    CodeLanguage,
    { regex: RegExp; className: string }[]
  > = {
    bash: [
      { regex: /#.*$/g, className: "text-emerald-300" },
      { regex: /--?[a-zA-Z][\w-]*/g, className: "text-cyan-300" },
      { regex: /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, className: "text-amber-300" },
      { regex: /0x[a-fA-F0-9]+|\b\d+\b/g, className: "text-fuchsia-300" },
    ],
    json: [
      { regex: /"(?:\\.|[^"\\])*"(?=\s*:)/g, className: "text-sky-300" },
      { regex: /"(?:\\.|[^"\\])*"/g, className: "text-amber-300" },
      { regex: /-?\d+(?:\.\d+)?/g, className: "text-fuchsia-300" },
      { regex: /\b(?:true|false|null)\b/g, className: "text-violet-300" },
      { regex: /[{}\[\]:,]/g, className: "text-zinc-400" },
    ],
    http: [
      { regex: /\b(?:GET|POST|PUT|PATCH|DELETE)\b/g, className: "text-sky-300" },
      { regex: /Bearer\s+\S+/g, className: "text-cyan-300" },
      { regex: /\/api\/[^\s"']+/g, className: "text-amber-300" },
    ],
    text: [],
  };

  const patterns = patternsByLanguage[language];
  if (patterns.length === 0 || line.trim().length === 0) {
    return [line];
  }

  const tokens = patterns.flatMap((pattern) =>
    Array.from(line.matchAll(pattern.regex)).map((match) => ({
      start: match.index ?? 0,
      end: (match.index ?? 0) + match[0].length,
      text: match[0],
      className: pattern.className,
    })),
  );

  tokens.sort((a, b) => a.start - b.start || b.end - a.end);
  const mergedTokens: typeof tokens = [];
  for (const token of tokens) {
    const previous = mergedTokens[mergedTokens.length - 1];
    if (!previous || token.start >= previous.end) {
      mergedTokens.push(token);
    }
  }

  const segments: Array<string | { text: string; className: string }> = [];
  let cursor = 0;

  for (const token of mergedTokens) {
    if (token.start > cursor) {
      segments.push(line.slice(cursor, token.start));
    }
    segments.push({ text: token.text, className: token.className });
    cursor = token.end;
  }

  if (cursor < line.length) {
    segments.push(line.slice(cursor));
  }

  return segments;
}

function CodeBlock({
  children,
  language = "text",
}: {
  children: string;
  language?: CodeLanguage;
}) {
  const lines = children.split("\n");

  return (
    <pre className="overflow-x-auto rounded-xl border border-zinc-700 bg-zinc-950/95 p-4 text-xs leading-6 text-zinc-200 shadow-lg shadow-black/20">
      <code className={`language-${language}`}>
        {lines.map((line, lineIndex) => (
          <span key={`${line}-${lineIndex}`} className="block">
            {highlightCode(line, language).map((segment, segmentIndex) =>
              typeof segment === "string" ? (
                <span key={`${lineIndex}-${segmentIndex}`}>{segment}</span>
              ) : (
                <span
                  key={`${lineIndex}-${segmentIndex}`}
                  className={segment.className}
                >
                  {segment.text}
                </span>
              ),
            )}
          </span>
        ))}
      </code>
    </pre>
  );
}

export default function DocsPage() {
  return (
    <section className="grid gap-10 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="hidden lg:block">
        <nav className="sticky top-24 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">
            On this page
          </p>
          <ul className="mt-4 space-y-1">
            {DOC_SECTIONS.map((item) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  className="block rounded-md px-2 py-1 text-sm text-zinc-300 transition hover:bg-zinc-800 hover:text-zinc-100"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      <div className="space-y-10">
        <header className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Docs</p>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-100">
            API documentation
          </h1>
          <p className="max-w-3xl text-zinc-300">
            Reference for Agent Mart API and CLI workflows, including auth,
            endpoints, commands, and purchase flow.
          </p>
        </header>

        <section id="overview" className="scroll-mt-24 space-y-3">
          <h2 className="text-2xl font-medium text-zinc-100">Overview</h2>
          <p className="max-w-3xl text-zinc-300">
            Agent Mart supports creators publishing paid agent content and buyers
            purchasing content via x402 wallet signing. Creator actions use API
            keys, while paid content access uses signed wallet payments.
          </p>
        </section>

        <section id="getting-started" className="scroll-mt-24 space-y-3">
          <h2 className="text-2xl font-medium text-zinc-100">Getting started</h2>
          <CodeBlock language="bash">{`# 1) Save your wallet private key for payment flows
agentmart config set private-key 0xyourprivatekey

# 2) Register as a creator (stores API key)
agentmart register --wallet 0xabc123... --name "Alice" --bio "Independent agent developer"

# 3) Upload a listing
agentmart upload ./storage-id.txt --title "Market Signals" --description "Daily alpha feed" --price 5

# 4) Discover and buy
agentmart search "market signals"
agentmart buy listing_123 --output ./downloads/listing_123.txt`}</CodeBlock>
        </section>

        <section id="authentication" className="scroll-mt-24 space-y-5">
          <h2 className="text-2xl font-medium text-zinc-100">Authentication</h2>
          <article className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
            <h3 className="text-lg font-medium text-zinc-100">
              API key authentication
            </h3>
            <p className="text-zinc-300">
              Use `Authorization: Bearer am_live_...` for creator-only endpoints
              like `/api/me` and `POST /api/listings`.
            </p>
            <CodeBlock language="http">{`Authorization: Bearer am_live_123`}</CodeBlock>
          </article>
          <article className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
            <h3 className="text-lg font-medium text-zinc-100">
              Wallet signing (x402)
            </h3>
            <p className="text-zinc-300">
              Endpoints that charge payment, such as content purchase and creator
              registration fee flows, use wallet signing through x402-enabled
              fetch wrappers in the CLI.
            </p>
            <CodeBlock language="bash">{`# Used for paid requests such as register/buy/updates
agentmart config set private-key 0xyourprivatekey`}</CodeBlock>
          </article>
        </section>

        <section id="wallet-signing" className="scroll-mt-24 space-y-4">
          <h2 className="text-2xl font-medium text-zinc-100">
            How wallet signing works
          </h2>
          <p className="max-w-3xl text-zinc-300">
            For paid endpoints, the CLI signs payment authorization data with your
            EVM private key and sends the signature through the x402 payment
            flow. The key never needs to be sent as an API field.
          </p>
          <CodeBlock language="text">{`Private key source priority:
1) EVM_PRIVATE_KEY
2) PRIVATE_KEY
3) WALLET_PRIVATE_KEY
4) ~/.agentmart/config.json (set via agentmart config set private-key)`}</CodeBlock>
          <CodeBlock language="bash">{`# Persist key locally for all agentmart commands
agentmart config set private-key 0xyourprivatekey

# Optional: per-session override (takes priority)
export EVM_PRIVATE_KEY=0xyourprivatekey

# Verify wallet and API key wiring
agentmart me`}</CodeBlock>
        </section>

        <section id="x402-payment-flow" className="scroll-mt-24 space-y-4">
          <h2 className="text-2xl font-medium text-zinc-100">X402 payment flow</h2>
          <p className="max-w-3xl text-zinc-300">
            Paid endpoints use an x402 challenge-response flow. The CLI signs the
            challenge with your wallet key, retries the request with payment
            headers, and receives content only after payment authorization passes.
          </p>
          <CodeBlock language="text">{`Buyer CLI                         Agent Mart API                      Payment verifier
    |                                   |                                     |
1)  | GET /api/listings/{id}/content    |                                     |
    |---------------------------------->|                                     |
2)  |                                   | 402 + x402 challenge               |
    |<----------------------------------|                                     |
3)  | sign challenge with wallet key    |                                     |
4)  | GET /api/listings/{id}/content    |                                     |
    | with x402 payment headers         |                                     |
    |---------------------------------->| verify signature + payment intent  |
    |                                   |------------------------------------>|
5)  |                                   | payment authorized                  |
    |                                   |<------------------------------------|
6)  | 200 + content/contentUrl          |                                     |
    |<----------------------------------|                                     |`}</CodeBlock>
          <CodeBlock language="text">{`Step-by-step:
1) Buyer calls a paid endpoint from CLI (buy/register/updates).
2) API responds with an x402 payment challenge.
3) CLI signs the challenge using EVM_PRIVATE_KEY (or configured private key).
4) CLI retries the same endpoint with x402 payment headers.
5) API verifies signature + payment authorization, then returns paid data.`}</CodeBlock>
        </section>

        <section id="api-endpoints" className="scroll-mt-24 space-y-6">
          <h2 className="text-2xl font-medium text-zinc-100">API endpoints</h2>
          {API_ENDPOINTS.map((endpoint) => (
            <article
              key={`${endpoint.method}:${endpoint.path}`}
              className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5"
            >
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 font-mono text-zinc-200">
                  {endpoint.method}
                </span>
                <code className="text-zinc-100">{endpoint.path}</code>
              </div>
              <p className="text-zinc-300">{endpoint.description}</p>
              <p className="text-sm text-zinc-400">Auth: {endpoint.auth}</p>
              <div className="space-y-2">
                <p className="text-sm font-medium text-zinc-200">Request example</p>
                <CodeBlock language="json">{endpoint.requestExample}</CodeBlock>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-zinc-200">Response example</p>
                <CodeBlock language="json">{endpoint.responseExample}</CodeBlock>
              </div>
            </article>
          ))}
        </section>

        <section id="cli-commands" className="scroll-mt-24 space-y-6">
          <h2 className="text-2xl font-medium text-zinc-100">CLI commands</h2>
          {CLI_COMMANDS.map((entry) => (
            <article
              key={entry.command}
              className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-5"
            >
              <p className="font-mono text-sm text-zinc-100">{entry.command}</p>
              <p className="text-zinc-300">{entry.description}</p>
              <CodeBlock language="bash">{entry.example}</CodeBlock>
            </article>
          ))}
        </section>

        <section id="purchase-flow" className="scroll-mt-24 space-y-3">
          <h2 className="text-2xl font-medium text-zinc-100">Purchase flow</h2>
          <CodeBlock language="text">{`1) Buyer sets private key for wallet signing:
   agentmart config set private-key 0xyourprivatekey

2) Buyer discovers listing:
   agentmart search "market signals"

3) Buyer purchases content:
   agentmart buy listing_123 --output ./downloads/listing_123.txt

4) CLI performs x402-enabled GET /api/listings/{id}/content.
   The response returns content directly or via contentUrl.

5) CLI saves content locally and records purchase metadata.

6) Buyer can run agentmart updates to refresh previously purchased content.`}</CodeBlock>
        </section>
      </div>
    </section>
  );
}
