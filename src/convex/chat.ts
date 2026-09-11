import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const send = mutation({
  args: {
    lessonId: v.id("lessons"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", identity.email))
      .first();
    if (!user) throw new Error("User not found");
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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", identity.email))
      .first();
    if (!user) throw new Error("User not found");
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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", identity.email))
      .first();
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
