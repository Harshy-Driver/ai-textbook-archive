import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const upload = mutation({
  args: {
    bookId: v.id("books"),
    imageUrl: v.string(),
    order: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", identity.email))
      .first();
    if (!user) throw new Error("User not found");
    const pageId = await ctx.db.insert("pages", {
      userId: user._id,
      bookId: args.bookId,
      imageUrl: args.imageUrl,
      order: args.order,
      status: "uploading",
      createdAt: Date.now(),
    });
    return pageId;
  },
});

export const updateStatus = mutation({
  args: {
    pageId: v.id("pages"),
    status: v.union(
      v.literal("uploading"),
      v.literal("processing"),
      v.literal("processed"),
      v.literal("failed"),
      v.literal("unreadable"),
    ),
    extractedText: v.optional(v.string()),
    ocrConfidence: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    chapterTitle: v.optional(v.string()),
    unitTitle: v.optional(v.string()),
    lessonTitle: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { pageId, ...updates } = args;
    await ctx.db.patch(pageId, updates);
    return { success: true };
  },
});

export const updateOrder = mutation({
  args: {
    pageId: v.id("pages"),
    order: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.pageId, { order: args.order });
    return { success: true };
  },
});

export const remove = mutation({
  args: { pageId: v.id("pages") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.pageId);
    return { success: true };
  },
});

export const listByBook = query({
  args: { bookId: v.id("books") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("pages")
      .withIndex("by_book", (q) => q.eq("bookId", args.bookId))
      .order("asc")
      .collect();
  },
});

export const listByUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", identity.email))
      .first();
    if (!user) return [];
    return await ctx.db
      .query("pages")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();
  },
});
