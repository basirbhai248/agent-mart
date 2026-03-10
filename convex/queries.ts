import { queryGeneric as query } from "convex/server";
import { v } from "convex/values";

export const getListings = query({
  args: {},
  handler: async (ctx) => {
    const listings = await ctx.db.query("listings").collect();
    return listings.filter((l) => l.isActive !== false);
  },
});

export const getListing = query({
  args: {
    listingId: v.id("listings"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.listingId);
  },
});

export const searchListings = query({
  args: {
    query: v.string(),
  },
  handler: async (ctx, args) => {
    const normalizedQuery = args.query.trim().toLowerCase();
    if (!normalizedQuery) {
      return [];
    }

    const listings = await ctx.db.query("listings").collect();
    return listings.filter((listing) => {
      if (listing.isActive === false) return false;
      return (
        listing.title.toLowerCase().includes(normalizedQuery) ||
        listing.description.toLowerCase().includes(normalizedQuery)
      );
    });
  },
});

export const getCreatorByWallet = query({
  args: {
    wallet: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("creators")
      .withIndex("by_wallet", (q) => q.eq("wallet", args.wallet))
      .unique();
  },
});

export const getCreatorByApiKey = query({
  args: {
    apiKey: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("creators")
      .withIndex("by_apiKey", (q) => q.eq("apiKey", args.apiKey))
      .unique();
  },
});

export const getCreatorListings = query({
  args: {
    creatorId: v.id("creators"),
  },
  handler: async (ctx, args) => {
    const listings = await ctx.db
      .query("listings")
      .withIndex("by_creatorId", (q) => q.eq("creatorId", args.creatorId))
      .collect();
    return listings.filter((l) => l.isActive !== false);
  },
});

export const getPurchase = query({
  args: {
    purchaseId: v.id("purchases"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.purchaseId);
  },
});

export const getPurchaseByListingAndBuyerWallet = query({
  args: {
    listingId: v.id("listings"),
    buyerWallet: v.string(),
  },
  handler: async (ctx, args) => {
    const purchases = await ctx.db
      .query("purchases")
      .withIndex("by_listingId", (q) => q.eq("listingId", args.listingId))
      .collect();

    return (
      purchases.find(
        (purchase) =>
          purchase.buyerWallet.toLowerCase() === args.buyerWallet.toLowerCase(),
      ) ?? null
    );
  },
});
