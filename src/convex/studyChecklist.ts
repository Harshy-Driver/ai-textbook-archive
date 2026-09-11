import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireUser, getCurrentUser } from "./helpers";

export const create = mutation({
  args: {
    lessonId: v.id("lessons"),
    items: v.array(
      v.object({
        text: v.string(),
        category: v.optional(v.string()),
        order: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const existing = await ctx.db
      .query("studyChecklist")
      .withIndex("by_lesson_user", (q) =>
        q.eq("lessonId", args.lessonId).eq("userId", user._id),
      )
      .collect();
    for (const item of existing) {
      await ctx.db.delete(item._id);
    }
    for (const item of args.items) {
      await ctx.db.insert("studyChecklist", {
        userId: user._id,
        lessonId: args.lessonId,
        text: item.text,
        category: item.category,
        status: "not_started",
        order: item.order,
      });
    }
    return { success: true };
  },
});

export const updateStatus = mutation({
  args: {
    itemId: v.id("studyChecklist"),
    status: v.union(
      v.literal("not_started"),
      v.literal("studying"),
      v.literal("completed"),
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.itemId, { status: args.status });
    return { success: true };
  },
});

export const list = query({
  args: { lessonId: v.id("lessons") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];
    return await ctx.db
      .query("studyChecklist")
      .withIndex("by_lesson_user", (q) =>
        q.eq("lessonId", args.lessonId).eq("userId", user._id),
      )
      .order("asc")
      .collect();
  },
});
