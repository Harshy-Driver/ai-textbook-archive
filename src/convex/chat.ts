import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireUser, getCurrentUser } from "./helpers";

export const send = mutation({
  args: {
    lessonId: v.id("lessons"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await ctx.db.insert("chatMessages", {
      userId: user._id,
      lessonId: args.lessonId,
      role: "user",
      content: args.content,
      timestamp: Date.now(),
    });
    return { success: true };
  },
});

export const addAssistantMessage = mutation({
  args: {
    lessonId: v.id("lessons"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    await ctx.db.insert("chatMessages", {
      userId: user._id,
      lessonId: args.lessonId,
      role: "assistant",
      content: args.content,
      timestamp: Date.now(),
    });
    return { success: true };
  },
});

export const listMessages = query({
  args: { lessonId: v.id("lessons") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];
    return await ctx.db
      .query("chatMessages")
      .withIndex("by_lesson_user", (q) =>
        q.eq("lessonId", args.lessonId).eq("userId", user._id),
      )
      .order("asc")
      .collect();
  },
});
