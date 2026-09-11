import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireUser, getCurrentUser } from "./helpers";

export const create = mutation({
  args: {
    title: v.string(),
    examDate: v.number(),
    sessions: v.array(
      v.object({
        date: v.number(),
        lessonId: v.optional(v.id("lessons")),
        subject: v.string(),
        topic: v.string(),
        durationMinutes: v.number(),
        order: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const oldPlans = await ctx.db
      .query("studyPlans")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    for (const plan of oldPlans) {
      await ctx.db.patch(plan._id, { isActive: false });
    }
    const planId = await ctx.db.insert("studyPlans", {
      userId: user._id,
      title: args.title,
      examDate: args.examDate,
      createdAt: Date.now(),
      isActive: true,
    });
    for (const session of args.sessions) {
      await ctx.db.insert("studyPlanSessions", {
        planId,
        userId: user._id,
        ...session,
        completed: false,
      });
    }
    return planId;
  },
});

export const markSessionComplete = mutation({
  args: { sessionId: v.id("studyPlanSessions") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sessionId, { completed: true });
    return { success: true };
  },
});

export const getActivePlan = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;
    const plan = await ctx.db
      .query("studyPlans")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .first();
    if (!plan) return null;
    const sessions = await ctx.db
      .query("studyPlanSessions")
      .withIndex("by_plan", (q) => q.eq("planId", plan._id))
      .order("asc")
      .collect();
    return { plan, sessions };
  },
});
