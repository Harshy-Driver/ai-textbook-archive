import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const recordAttempt = mutation({
  args: {
    lessonId: v.id("lessons"),
    mode: v.union(
      v.literal("lesson"),
      v.literal("exam"),
      v.literal("page"),
      v.literal("weak_topics"),
    ),
    questionCount: v.number(),
    difficulty: v.string(),
    questionTypes: v.string(),
    score: v.number(),
    totalQuestions: v.number(),
    percentage: v.number(),
    answers: v.string(),
    duration: v.optional(v.number()),
    bookId: v.optional(v.id("books")),
    chapterIds: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", identity.email))
      .first();
    if (!user) throw new Error("User not found");
    const attemptId = await ctx.db.insert("quizAttempts", {
      userId: user._id,
      ...args,
      completedAt: Date.now(),
    });
    return attemptId;
  },
});

export const saveQuestions = mutation({
  args: {
    attemptId: v.id("quizAttempts"),
    questions: v.array(
      v.object({
        questionIndex: v.number(),
        questionText: v.string(),
        questionType: v.string(),
        options: v.optional(v.string()),
        correctAnswer: v.string(),
        userAnswer: v.optional(v.string()),
        explanation: v.string(),
        relatedTopic: v.optional(v.string()),
        lessonId: v.id("lessons"),
      }),
    ),
  },
  handler: async (ctx, args) => {
    for (const q of args.questions) {
      await ctx.db.insert("quizQuestions", {
        attemptId: args.attemptId,
        ...q,
      });
    }
    return { success: true };
  },
});

export const listAttempts = query({
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
      .query("quizAttempts")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();
  },
});

export const listByLesson = query({
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
      .query("quizAttempts")
      .withIndex("by_user_lesson", (q) =>
        q.eq("userId", user._id).eq("lessonId", args.lessonId),
      )
      .order("desc")
      .collect();
  },
});

export const getQuestions = query({
  args: { attemptId: v.id("quizAttempts") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("quizQuestions")
      .withIndex("by_attempt", (q) => q.eq("attemptId", args.attemptId))
      .order("asc")
      .collect();
  },
});

// Get topic performance
export const getTopicPerformance = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", identity.email))
      .first();
    if (!user) return [];
    const attempts = await ctx.db
      .query("quizAttempts")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    // Group by lesson
    const topicMap: Record<string, { total: number; correct: number; lessonId: string }> = {};
    for (const attempt of attempts) {
      const lid = attempt.lessonId;
      if (!topicMap[lid]) {
        topicMap[lid] = { total: 0, correct: 0, lessonId: lid };
      }
      topicMap[lid].total += attempt.totalQuestions;
      topicMap[lid].correct += attempt.score;
    }
    const results = Object.values(topicMap).map((t) => ({
      lessonId: t.lessonId,
      percentage: t.total > 0 ? Math.round((t.correct / t.total) * 100) : 0,
      totalQuestions: t.total,
      correct: t.correct,
    }));
    results.sort((a, b) => a.percentage - b.percentage);
    return results;
  },
});
