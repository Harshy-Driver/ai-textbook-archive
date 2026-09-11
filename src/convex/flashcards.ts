import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireUser, getCurrentUser } from "./helpers";

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
    const user = await requireUser(ctx);
    const existing = await ctx.db
      .query("flashcards")
      .withIndex("by_lesson_user", (q) =>
        q.eq("lessonId", args.lessonId).eq("userId", user._id),
      )
      .collect();
    for (const card of existing) {
      await ctx.db.delete(card._id);
    }
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
    const user = await getCurrentUser(ctx);
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
