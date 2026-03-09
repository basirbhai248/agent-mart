import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("docs page includes full API, CLI, auth, and purchase flow documentation", async () => {
  const pageSource = await readFile("./src/app/docs/page.tsx", "utf8");

  assert.match(pageSource, /API documentation/);
  assert.match(pageSource, /On this page/);
  assert.match(pageSource, /href={`#\$\{item\.id\}`}/);
  assert.match(pageSource, /Overview/);
  assert.match(pageSource, /Getting started/);
  assert.match(pageSource, /Authentication/);
  assert.match(pageSource, /id="overview"/);
  assert.match(pageSource, /id="getting-started"/);
  assert.match(pageSource, /id="authentication"/);
  assert.match(pageSource, /id="wallet-signing"/);
  assert.match(pageSource, /id="x402-payment-flow"/);
  assert.match(pageSource, /id="api-endpoints"/);
  assert.match(pageSource, /id="cli-commands"/);
  assert.match(pageSource, /id="purchase-flow"/);
  assert.match(pageSource, /API key authentication/);
  assert.match(pageSource, /Wallet signing \(x402\)/);
  assert.match(pageSource, /How wallet signing works/);
  assert.match(pageSource, /X402 payment flow/);
  assert.match(pageSource, /402 \+ x402 challenge/);
  assert.match(pageSource, /with x402 payment headers/);
  assert.match(pageSource, /Step-by-step:/);
  assert.match(pageSource, /API verifies signature \+ payment authorization/);
  assert.match(pageSource, /Private key source priority:/);
  assert.match(
    pageSource,
    /1\) EVM_PRIVATE_KEY[\s\S]*2\) PRIVATE_KEY[\s\S]*3\) WALLET_PRIVATE_KEY/,
  );
  assert.match(pageSource, /agentmart config set private-key 0xyourprivatekey/);
  assert.match(pageSource, /CodeBlock language="bash"/);
  assert.match(pageSource, /CodeBlock language="json"/);

  assert.match(pageSource, /"\/api\/register"/);
  assert.match(pageSource, /"\/api\/recover"/);
  assert.match(pageSource, /"\/api\/me"/);
  assert.match(pageSource, /"\/api\/listings"/);
  assert.match(pageSource, /"\/api\/listings\/\{id\}"/);
  assert.match(pageSource, /"\/api\/listings\/\{id\}\/content"/);
  assert.match(pageSource, /"\/api\/search\?q=\{query\}"/);
  assert.match(pageSource, /"\/api\/creators"/);
  assert.match(pageSource, /"\/api\/creators\/\{wallet\}"/);

  assert.match(
    pageSource,
    /agentmart register --wallet <addr> --name <name> --bio <bio>/,
  );
  assert.match(
    pageSource,
    /agentmart recover --wallet <addr> --signature <sig>/,
  );
  assert.match(
    pageSource,
    /agentmart upload <file> --title <title> --description <desc> --price <usdc>/,
  );
  assert.match(pageSource, /agentmart search <query>/);
  assert.match(pageSource, /agentmart list --creator <wallet>/);
  assert.match(pageSource, /agentmart buy <listing-id> \[--output <file>\]/);
  assert.match(pageSource, /agentmart me/);
  assert.match(pageSource, /agentmart updates/);
  assert.match(pageSource, /agentmart config set private-key <key>/);

  assert.match(pageSource, /Purchase flow/);
  assert.match(
    pageSource,
    /CLI performs x402-enabled GET \/api\/listings\/\{id\}\/content\./,
  );
  assert.match(pageSource, /records purchase metadata/);
});
