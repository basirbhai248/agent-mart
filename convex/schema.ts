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
    updatedAt: v.optional(v.number()),
    isActive: v.optional(v.boolean()),
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
  payouts: defineTable({
    purchaseId: v.optional(v.id("purchases")),
    listingId: v.optional(v.id("listings")),
    creatorId: v.optional(v.id("creators")),
    creatorWallet: v.string(),
    grossAmount: v.number(),
    creatorAmount: v.number(),
    platformAmount: v.number(),
    txHash: v.optional(v.string()),
    status: v.string(),
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
    error: v.optional(v.string()),
  })
    .index("by_creatorId", ["creatorId"])
    .index("by_status", ["status"]),
});
