import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireUser, getCurrentUser } from "./helpers";

export const create = mutation({
  args: {
    lessonId: v.id("lessons"),
    items: v.array(
      v.object({
        level: v.union(
          v.literal("must_know"),
          v.literal("important"),
          v.literal("extra"),
        ),
        content: v.string(),
        sourcePageId: v.optional(v.id("pages")),
        order: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const existing = await ctx.db
      .query("lessonInfo")
      .withIndex("by_lesson_user", (q) =>
        q.eq("lessonId", args.lessonId).eq("userId", user._id),
      )
      .collect();
    for (const item of existing) {
      await ctx.db.delete(item._id);
    }
    for (const item of args.items) {
      await ctx.db.insert("lessonInfo", {
        userId: user._id,
        lessonId: args.lessonId,
        level: item.level,
        content: item.content,
        sourcePageId: item.sourcePageId,
        order: item.order,
      });
    }
    return { success: true };
  },
});

export const list = query({
  args: { lessonId: v.id("lessons") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];
    return await ctx.db
      .query("lessonInfo")
      .withIndex("by_lesson_user", (q) =>
        q.eq("lessonId", args.lessonId).eq("userId", user._id),
      )
      .order("asc")
      .collect();
  },
});
