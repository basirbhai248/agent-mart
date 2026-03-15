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

export const updateCreatorApiKey = mutation({
  args: {
    creatorId: v.id("creators"),
    apiKey: v.string(),
  },
  handler: async (ctx, args) => {
    const creator = await ctx.db.get(args.creatorId);
    if (!creator) {
      throw new Error("Creator not found");
    }

    await ctx.db.patch(args.creatorId, {
      apiKey: args.apiKey,
    });

    return args.creatorId;
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

export const updateListing = mutation({
  args: {
    listingId: v.id("listings"),
    apiKey: v.string(),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    priceUsdc: v.optional(v.number()),
    fileStorageId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const creator = await ctx.db
      .query("creators")
      .withIndex("by_apiKey", (q) => q.eq("apiKey", args.apiKey))
      .unique();
    if (!creator) {
      throw new Error("Invalid API key");
    }

    const listing = await ctx.db.get(args.listingId);
    if (!listing) {
      throw new Error("Listing not found");
    }
    if (listing.creatorId !== creator._id) {
      throw new Error("Not authorized to update this listing");
    }

    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.title !== undefined) updates.title = args.title;
    if (args.description !== undefined) updates.description = args.description;
    if (args.priceUsdc !== undefined) updates.priceUsdc = args.priceUsdc;
    if (args.fileStorageId !== undefined)
      updates.fileStorageId = args.fileStorageId;

    await ctx.db.patch(args.listingId, updates);
    return args.listingId;
  },
});

export const deleteListing = mutation({
  args: {
    listingId: v.id("listings"),
    apiKey: v.string(),
  },
  handler: async (ctx, args) => {
    const creator = await ctx.db
      .query("creators")
      .withIndex("by_apiKey", (q) => q.eq("apiKey", args.apiKey))
      .unique();
    if (!creator) {
      throw new Error("Invalid API key");
    }

    const listing = await ctx.db.get(args.listingId);
    if (!listing) {
      throw new Error("Listing not found");
    }
    if (listing.creatorId !== creator._id) {
      throw new Error("Not authorized to delete this listing");
    }

    await ctx.db.patch(args.listingId, { isActive: false });
    return args.listingId;
  },
});


export const recordPayout = mutation({
  args: {
    purchaseId: v.optional(v.id("purchases")),
    listingId: v.optional(v.id("listings")),
    creatorId: v.optional(v.id("creators")),
    creatorWallet: v.string(),
    grossAmount: v.number(),
    creatorAmount: v.number(),
    platformAmount: v.number(),
    txHash: v.optional(v.string()),
    status: v.string(),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("payouts", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const updatePayoutStatus = mutation({
  args: {
    payoutId: v.id("payouts"),
    status: v.string(),
    txHash: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const payout = await ctx.db.get(args.payoutId);
    if (!payout) {
      throw new Error("Payout not found");
    }

    const updates: Record<string, unknown> = { status: args.status };
    if (args.txHash !== undefined) updates.txHash = args.txHash;
    if (args.error !== undefined) updates.error = args.error;
    if (args.status === "completed") updates.completedAt = Date.now();

    await ctx.db.patch(args.payoutId, updates);
    return args.payoutId;
  },
});

export const updateCreatorSubscription = mutation({
  args: {
    creatorId: v.id("creators"),
    subscriptionId: v.optional(v.string()),
    subscriptionStatus: v.string(),
    subscriptionExpiresAt: v.optional(v.number()),
    subscriptionTxHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const creator = await ctx.db.get(args.creatorId);
    if (!creator) {
      throw new Error("Creator not found");
    }

    const updates: Record<string, unknown> = {
      subscriptionStatus: args.subscriptionStatus,
    };
    if (args.subscriptionId !== undefined) {
      updates.subscriptionId = args.subscriptionId;
    }
    if (args.subscriptionExpiresAt !== undefined) {
      updates.subscriptionExpiresAt = args.subscriptionExpiresAt;
    }
    if (args.subscriptionTxHash !== undefined) {
      updates.subscriptionTxHash = args.subscriptionTxHash;
    }

    await ctx.db.patch(args.creatorId, updates);
    return args.creatorId;
  },
});
