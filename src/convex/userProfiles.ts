import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const updateProfile = mutation({
  args: {
    grade: v.optional(v.union(v.literal(9), v.literal(10), v.literal(11))),
    subject: v.optional(v.union(v.literal("physics"), v.literal("biology"))),
    curriculum: v.optional(v.union(v.literal("general"), v.literal("advanced"))),
    language: v.optional(v.string()),
    name: v.optional(v.string()),
    onboardingCompleted: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", identity.email))
      .first();
    if (!user) throw new Error("User not found");
    await ctx.db.patch(user._id, args);
    return { success: true };
  },
});

export const getProfile = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", identity.email))
      .first();
    return user;
  },
});
