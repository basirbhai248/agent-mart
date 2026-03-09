import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("listing detail page renders listing fields and CLI-only purchase notice", async () => {
  const pageSource = await readFile("./src/app/listings/[id]/page.tsx", "utf8");

  assert.match(pageSource, /\/api\/listings\/\$\{encodeURIComponent\(id\)\}/);
  assert.match(pageSource, /\{listing\.title\}/);
  assert.match(pageSource, /\{listing\.description\}/);
  assert.match(pageSource, /\{listing\.priceUsdc\} USDC/);
  assert.match(
    pageSource,
    /creatorName \?\? listing\.creatorWallet \?\? listing\.creatorId/,
  );
  assert.match(pageSource, /Unknown creator/);
  assert.match(
    pageSource,
    /Purchases are agent-only and must be completed via CLI\./,
  );
});
