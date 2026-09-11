import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const upsert = mutation({
  args: {
    lessonId: v.id("lessons"),
    progressPercent: v.number(),
    studyMinutes: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", identity.email))
      .first();
    if (!user) throw new Error("User not found");
    const existing = await ctx.db
      .query("studyProgress")
      .withIndex("by_user_lesson", (q) =>
        q.eq("userId", user._id).eq("lessonId", args.lessonId),
      )
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        progressPercent: args.progressPercent,
        studyMinutes: existing.studyMinutes + args.studyMinutes,
        lastStudied: Date.now(),
        totalStudySessions: existing.totalStudySessions + 1,
      });
    } else {
      await ctx.db.insert("studyProgress", {
        userId: user._id,
        lessonId: args.lessonId,
        progressPercent: args.progressPercent,
        studyMinutes: args.studyMinutes,
        lastStudied: Date.now(),
        totalStudySessions: 1,
      });
    }
    // Update daily stats
    const today = new Date().toISOString().split("T")[0];
    const dailyStat = await ctx.db
      .query("dailyStats")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", user._id).eq("date", today),
      )
      .first();
    if (dailyStat) {
      await ctx.db.patch(dailyStat._id, {
        studyMinutes: dailyStat.studyMinutes + args.studyMinutes,
        lessonsStudied: dailyStat.lessonsStudied + 1,
      });
    } else {
      await ctx.db.insert("dailyStats", {
        userId: user._id,
        date: today,
        studyMinutes: args.studyMinutes,
        quizzesTaken: 0,
        quizzesCorrect: 0,
        lessonsStudied: 1,
      });
    }
    return { success: true };
  },
});

export const getUserProgress = query({
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
      .query("studyProgress")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
  },
});

export const recordQuiz = mutation({
  args: {
    quizCorrect: v.number(),
    quizTotal: v.number(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", identity.email))
      .first();
    if (!user) throw new Error("User not found");
    const today = new Date().toISOString().split("T")[0];
    const dailyStat = await ctx.db
      .query("dailyStats")
      .withIndex("by_user_date", (q) =>
        q.eq("userId", user._id).eq("date", today),
      )
      .first();
    if (dailyStat) {
      await ctx.db.patch(dailyStat._id, {
        quizzesTaken: dailyStat.quizzesTaken + 1,
        quizzesCorrect: dailyStat.quizzesCorrect + args.quizCorrect,
      });
    } else {
      await ctx.db.insert("dailyStats", {
        userId: user._id,
        date: today,
        studyMinutes: 0,
        quizzesTaken: 1,
        quizzesCorrect: args.quizCorrect,
        lessonsStudied: 0,
      });
    }
    return { success: true };
  },
});

export const getDailyStats = query({
  args: { days: v.number() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", identity.email))
      .first();
    if (!user) return [];
    const stats = await ctx.db
      .query("dailyStats")
      .withIndex("by_user_date", (q) => q.eq("userId", user._id))
      .collect();
    // Sort by date desc and limit
    stats.sort((a, b) => b.date.localeCompare(a.date));
    return stats.slice(0, args.days);
  },
});
