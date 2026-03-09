import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("search page renders search input and results grid backed by /api/search", async () => {
  const pageSource = await readFile("./src/app/search/page.tsx", "utf8");

  assert.match(pageSource, /\{ q\?: string \}/);
  assert.match(
    pageSource,
    /\/api\/search\?q=\$\{encodeURIComponent\(query\)\}/,
  );
  assert.match(pageSource, /<form action="\/search" role="search"/);
  assert.match(pageSource, /name="q"/);
  assert.match(pageSource, /placeholder="Search by title or description"/);
  assert.match(pageSource, /listings\.length === 0/);
  assert.match(pageSource, /No listings found for "\{query\}"\./);
  assert.match(pageSource, /listings\.map\(\(listing\) =>/);
  assert.match(pageSource, /\{listing\.title\}/);
  assert.match(pageSource, /\{listing\.description\}/);
  assert.match(
    pageSource,
    /Creator:\s*\{listing\.creatorName \?\? "Unknown creator"\}/,
  );
  assert.match(pageSource, /\{listing\.priceUsdc\} USDC/);
  assert.match(pageSource, /href=\{`\/listings\/\$\{listing\._id\}`\}/);
});
