import assert from "node:assert/strict";
import test from "node:test";

const { default: schema } = await import("./schema.ts");

const exportedSchema = JSON.parse(schema.export());
const tables = Object.fromEntries(
  exportedSchema.tables.map((table) => [table.tableName, table]),
);

test("schema defines creators, listings, and purchases tables", () => {
  assert.deepEqual(Object.keys(tables).sort(), [
    "creators",
    "listings",
    "purchases",
  ]);
});

test("schema defines expected indexes and fields", () => {
  assert.deepEqual(tables.creators.indexes, [
    {
      indexDescriptor: "by_wallet",
      fields: ["wallet"],
    },
  ]);
  assert.equal(
    tables.creators.documentType.value.wallet.fieldType.type,
    "string",
  );
  assert.equal(tables.creators.documentType.value.twitterHandle.optional, true);

  assert.deepEqual(tables.listings.indexes, [
    {
      indexDescriptor: "by_creatorId",
      fields: ["creatorId"],
    },
  ]);
  assert.equal(
    tables.listings.documentType.value.creatorId.fieldType.type,
    "id",
  );
  assert.equal(
    tables.listings.documentType.value.priceUsdc.fieldType.type,
    "number",
  );

  assert.deepEqual(tables.purchases.indexes, [
    {
      indexDescriptor: "by_listingId",
      fields: ["listingId"],
    },
    {
      indexDescriptor: "by_buyerWallet",
      fields: ["buyerWallet"],
    },
  ]);
  assert.equal(
    tables.purchases.documentType.value.txHash.fieldType.type,
    "string",
  );
});
