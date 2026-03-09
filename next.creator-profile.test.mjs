import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("creator profile page renders creator metadata and listing grid", async () => {
  const pageSource = await readFile(
    "./src/app/creators/[wallet]/page.tsx",
    "utf8",
  );

  assert.match(
    pageSource,
    /\/api\/creators\/\$\{encodeURIComponent\(wallet\)\}/,
  );
  assert.match(pageSource, /if \(response\.status === 404\)/);
  assert.match(pageSource, /\{displayName\}/);
  assert.match(pageSource, /\{bio\}/);
  assert.match(pageSource, /Twitter: \{twitterHandle \?\? "Not provided"\}/);
  assert.match(pageSource, /listings\.length === 0/);
  assert.match(pageSource, /This creator has no listings yet\./);
  assert.match(pageSource, /listings\.map\(\(listing\) =>/);
  assert.match(pageSource, /\{listing\.title\}/);
  assert.match(pageSource, /\{listing\.priceUsdc\} USDC/);
  assert.match(pageSource, /href=\{`\/listings\/\$\{listing\._id\}`\}/);
});
