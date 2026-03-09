import { mutationGeneric as mutation } from "convex/server";
import { v } from "convex/values";

export const createCreator = mutation({
  args: {
    wallet: v.string(),
    displayName: v.string(),
    bio: v.string(),
    twitterHandle: v.optional(v.string()),
    apiKey: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("creators", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const createListing = mutation({
  args: {
    creatorId: v.id("creators"),
    title: v.string(),
    description: v.string(),
    priceUsdc: v.number(),
    fileStorageId: v.string(),
  },
  handler: async (ctx, args) => {
    const creator = await ctx.db.get(args.creatorId);
    if (!creator) {
      throw new Error("Creator not found");
    }

    return await ctx.db.insert("listings", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const recordPurchase = mutation({
  args: {
    listingId: v.id("listings"),
    buyerWallet: v.string(),
    amountPaid: v.number(),
    txHash: v.string(),
  },
  handler: async (ctx, args) => {
    const listing = await ctx.db.get(args.listingId);
    if (!listing) {
      throw new Error("Listing not found");
    }

    return await ctx.db.insert("purchases", {
      ...args,
      createdAt: Date.now(),
    });
  },
});
