import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  creators: defineTable({
    wallet: v.string(),
    displayName: v.string(),
    bio: v.string(),
    twitterHandle: v.optional(v.string()),
    apiKey: v.string(),
    createdAt: v.number(),
  })
    .index("by_wallet", ["wallet"])
    .index("by_apiKey", ["apiKey"]),

  listings: defineTable({
    creatorId: v.id("creators"),
    title: v.string(),
    description: v.string(),
    priceUsdc: v.number(),
    fileStorageId: v.string(),
    createdAt: v.number(),
  }).index("by_creatorId", ["creatorId"]),

  purchases: defineTable({
    listingId: v.id("listings"),
    buyerWallet: v.string(),
    amountPaid: v.number(),
    txHash: v.string(),
    createdAt: v.number(),
  })
    .index("by_listingId", ["listingId"])
    .index("by_buyerWallet", ["buyerWallet"]),
});
