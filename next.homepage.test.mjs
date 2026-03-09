import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("homepage renders hero and featured listings grid from /api/listings", async () => {
  const pageSource = await readFile("./src/app/page.tsx", "utf8");

  assert.match(pageSource, /Gumroad for agents/);
  assert.match(pageSource, /Featured listings/);
  assert.match(pageSource, /\/api\/listings/);
  assert.match(pageSource, /listing\.title/);
  assert.match(pageSource, /listing\.priceUsdc\} USDC/);
  assert.match(
    pageSource,
    /Creator:\s*\{listing\.creatorName\s*\?\?\s*"Unknown creator"\}/,
  );
});
