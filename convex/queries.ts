import { queryGeneric as query } from "convex/server";
import { v } from "convex/values";

export const getListings = query({
  args: {},
  handler: async (ctx) => {
    const listings = await ctx.db.query("listings").collect();
    const active = listings.filter((l) => l.isActive !== false);

    const creatorIds = [...new Set(active.map((l) => l.creatorId))];
    const creators = await Promise.all(creatorIds.map((id) => ctx.db.get(id)));
    const creatorMap = new Map(
      creators
        .filter(Boolean)
        .map((c) => [c!._id, c!]),
    );

    return active
      .filter((l) => {
        const creator = creatorMap.get(l.creatorId);
        return creator?.subscriptionStatus !== "lapsed";
      })
      .map((l) => ({
        ...l,
        creatorName: creatorMap.get(l.creatorId)?.displayName ?? "Unknown",
      }));
  },
});

export const getListing = query({
  args: {
    listingId: v.id("listings"),
  },
  handler: async (ctx, args) => {
    const listing = await ctx.db.get(args.listingId);
    if (!listing) return null;

    const creator = await ctx.db.get(listing.creatorId);
    return {
      ...listing,
      creatorName: creator?.displayName ?? "Unknown",
      creatorWallet: creator?.wallet ?? null,
    };
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
    const matches = listings.filter((listing) => {
      if (listing.isActive === false) return false;
      return (
        listing.title.toLowerCase().includes(normalizedQuery) ||
        listing.description.toLowerCase().includes(normalizedQuery)
      );
    });

    const creatorIds = [...new Set(matches.map((l) => l.creatorId))];
    const creators = await Promise.all(creatorIds.map((id) => ctx.db.get(id)));
    const creatorMap = new Map(
      creators
        .filter(Boolean)
        .map((c) => [c!._id, c!]),
    );

    return matches
      .filter((l) => {
        const creator = creatorMap.get(l.creatorId);
        return creator?.subscriptionStatus !== "lapsed";
      })
      .map((l) => ({
        ...l,
        creatorName: creatorMap.get(l.creatorId)?.displayName ?? "Unknown",
      }));
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

export const getCreatorsWithDueSubscriptions = query({
  args: {},
  handler: async (ctx) => {
    const creators = await ctx.db.query("creators").collect();
    const now = Date.now();
    return creators.filter(
      (c) =>
        c.subscriptionStatus === "active" &&
        c.subscriptionExpiresAt !== undefined &&
        c.subscriptionExpiresAt < now,
    );
  },
});

export const getFailedPayouts = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("payouts")
      .withIndex("by_status", (q) => q.eq("status", "failed"))
      .collect();
  },
});
