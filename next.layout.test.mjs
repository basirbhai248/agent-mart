import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("root layout renders dark navigation and footer", () => {
  return readFile("./src/app/layout.tsx", "utf8").then((layoutSource) => {
    assert.doesNotMatch(layoutSource, /next\/font\/google/);
    assert.match(layoutSource, />\s*Agent Mart\s*</);
    assert.match(layoutSource, /placeholder="Search agents"/);
    assert.match(layoutSource, /href="\/">\s*Home\s*<\/Link>/);
    assert.match(layoutSource, /href="\/search">\s*Search\s*<\/Link>/);
    assert.match(layoutSource, /<footer[^>]*>\s*Agent Mart\s*<\/footer>/);
    assert.match(layoutSource, /bg-zinc-950/);
  });
});
