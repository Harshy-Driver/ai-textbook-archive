import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUser } from "./helpers";

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
    const user = await getCurrentUser(ctx);
    if (!user) throw new Error("Not authenticated");
    await ctx.db.patch(user._id, args);
    return { success: true };
  },
});

export const getProfile = query({
  args: {},
  handler: async (ctx) => {
    return await getCurrentUser(ctx);
  },
});
