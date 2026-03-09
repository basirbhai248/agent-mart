import assert from "node:assert/strict";
import test from "node:test";

import { createUploadAction, uploadListing } from "./bin/upload.js";

test("uploadListing reads file and posts /api/listings with bearer auth", async () => {
  const calls = [];

  const result = await uploadListing(
    " ./guide.md ",
    {
      title: " Twitter API Setup ",
      description: " How to post tweets ",
      price: " 0.5 ",
      apiUrl: "https://agentmart.dev",
      apiKey: " key_123 ",
    },
    {
      fsModule: {
        readFile: async (filePath, encoding) => {
          assert.equal(filePath, "./guide.md");
          assert.equal(encoding, "utf8");
          return " file_1 ";
        },
      },
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), init });
        return new Response(JSON.stringify({ listingId: "listing_1" }), {
          status: 201,
          headers: { "content-type": "application/json" },
        });
      },
    },
  );

  assert.equal(result.listingId, "listing_1");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://agentmart.dev/api/listings");
  assert.equal(calls[0].init.method, "POST");
  assert.deepEqual(calls[0].init.headers, {
    authorization: "Bearer key_123",
    "content-type": "application/json",
  });
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    title: "Twitter API Setup",
    description: "How to post tweets",
    priceUsdc: 0.5,
    fileStorageId: "file_1",
  });
});

test("uploadListing uses AGENTMART_API_KEY from env", async () => {
  const result = await uploadListing(
    "guide.md",
    { title: "Title", description: "Desc", price: "1.25" },
    {
      env: { AGENTMART_API_KEY: "env_key" },
      fsModule: { readFile: async () => "file_2" },
      fetchImpl: async (_url, init) => {
        assert.equal(init.headers.authorization, "Bearer env_key");
        return new Response(JSON.stringify({ listingId: "listing_2" }), {
          status: 201,
          headers: { "content-type": "application/json" },
        });
      },
    },
  );

  assert.equal(result.listingId, "listing_2");
});

test("uploadListing validates required values and price", async () => {
  await assert.rejects(
    uploadListing(undefined, { title: "T", description: "D", price: "1" }),
    /<file> is required/,
  );
  await assert.rejects(
    uploadListing("guide.md", { description: "D", price: "1" }),
    /--title is required/,
  );
  await assert.rejects(
    uploadListing("guide.md", { title: "T", description: "D", price: "0" }),
    /--price must be a positive number/,
  );
});

test("uploadListing fails when API key is missing", async () => {
  await assert.rejects(
    uploadListing(
      "guide.md",
      { title: "T", description: "D", price: "1" },
      { fsModule: { readFile: async () => "file_3" } },
    ),
    /Missing API key/,
  );
});

test("uploadListing fails when file is empty", async () => {
  await assert.rejects(
    uploadListing(
      "guide.md",
      { title: "T", description: "D", price: "1", apiKey: "key_123" },
      { fsModule: { readFile: async () => " \n\t " } },
    ),
    /File content cannot be empty/,
  );
});

test("uploadListing surfaces API errors", async () => {
  await assert.rejects(
    uploadListing(
      "guide.md",
      { title: "T", description: "D", price: "1", apiKey: "key_123" },
      {
        fsModule: { readFile: async () => "file_4" },
        fetchImpl: async () =>
          new Response(JSON.stringify({ error: "invalid API key" }), {
            status: 401,
            headers: { "content-type": "application/json" },
          }),
      },
    ),
    /Upload failed \(401\): invalid API key/,
  );
});

test("createUploadAction logs listing confirmation", async () => {
  const logs = [];
  const action = createUploadAction({
    logger: { log: (line) => logs.push(line) },
    fsModule: { readFile: async () => "file_5" },
    fetchImpl: async () =>
      new Response(JSON.stringify({ listingId: "listing_5" }), {
        status: 201,
        headers: { "content-type": "application/json" },
      }),
  });

  await action("guide.md", {
    title: "Title",
    description: "Desc",
    price: "1",
    apiKey: "key_123",
  });

  assert.deepEqual(logs, ["Listing created: listing_5"]);
});
