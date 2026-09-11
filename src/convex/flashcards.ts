import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    lessonId: v.id("lessons"),
    cards: v.array(
      v.object({
        front: v.string(),
        back: v.string(),
        order: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", identity.email))
      .first();
    if (!user) throw new Error("User not found");
    // Delete existing
    const existing = await ctx.db
      .query("flashcards")
      .withIndex("by_lesson_user", (q) =>
        q.eq("lessonId", args.lessonId).eq("userId", user._id),
      )
      .collect();
    for (const card of existing) {
      await ctx.db.delete(card._id);
    }
    // Create new
    for (const card of args.cards) {
      await ctx.db.insert("flashcards", {
        userId: user._id,
        lessonId: args.lessonId,
        front: card.front,
        back: card.back,
        known: false,
        forReview: false,
        order: card.order,
      });
    }
    return { success: true };
  },
});

export const markKnown = mutation({
  args: { cardId: v.id("flashcards"), known: v.boolean() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.cardId, { known: args.known });
    return { success: true };
  },
});

export const markReview = mutation({
  args: { cardId: v.id("flashcards"), forReview: v.boolean() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.cardId, { forReview: args.forReview });
    return { success: true };
  },
});

export const list = query({
  args: { lessonId: v.id("lessons") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", identity.email))
      .first();
    if (!user) return [];
    return await ctx.db
      .query("flashcards")
      .withIndex("by_lesson_user", (q) =>
        q.eq("lessonId", args.lessonId).eq("userId", user._id),
      )
      .order("asc")
      .collect();
  },
});
