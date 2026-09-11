import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireUser, getCurrentUser } from "./helpers";

// ---- Units ----
export const createUnit = mutation({
  args: {
    bookId: v.id("books"),
    title: v.string(),
    order: v.number(),
    term: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const unitId = await ctx.db.insert("units", {
      userId: user._id,
      bookId: args.bookId,
      title: args.title,
      order: args.order,
      term: args.term,
    });
    return unitId;
  },
});

export const listUnits = query({
  args: { bookId: v.id("books") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("units")
      .withIndex("by_book", (q) => q.eq("bookId", args.bookId))
      .order("asc")
      .collect();
  },
});

// ---- Chapters ----
export const createChapter = mutation({
  args: {
    bookId: v.id("books"),
    unitId: v.optional(v.id("units")),
    title: v.string(),
    order: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const chapterId = await ctx.db.insert("chapters", {
      userId: user._id,
      bookId: args.bookId,
      unitId: args.unitId,
      title: args.title,
      order: args.order,
    });
    return chapterId;
  },
});

export const listChapters = query({
  args: { bookId: v.id("books") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("chapters")
      .withIndex("by_book", (q) => q.eq("bookId", args.bookId))
      .order("asc")
      .collect();
  },
});

// ---- Lessons ----
export const createLesson = mutation({
  args: {
    bookId: v.id("books"),
    chapterId: v.id("chapters"),
    title: v.string(),
    order: v.number(),
    summary: v.optional(v.string()),
    keyTerms: v.optional(v.string()),
    formulas: v.optional(v.string()),
    objectives: v.optional(v.string()),
    importanceLevel: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const lessonId = await ctx.db.insert("lessons", {
      userId: user._id,
      bookId: args.bookId,
      chapterId: args.chapterId,
      title: args.title,
      order: args.order,
      summary: args.summary,
      keyTerms: args.keyTerms,
      formulas: args.formulas,
      objectives: args.objectives,
      importanceLevel: args.importanceLevel,
    });
    return lessonId;
  },
});

export const updateLesson = mutation({
  args: {
    lessonId: v.id("lessons"),
    title: v.optional(v.string()),
    summary: v.optional(v.string()),
    keyTerms: v.optional(v.string()),
    formulas: v.optional(v.string()),
    objectives: v.optional(v.string()),
    importanceLevel: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { lessonId, ...updates } = args;
    await ctx.db.patch(lessonId, updates);
    return { success: true };
  },
});

export const listLessons = query({
  args: { chapterId: v.id("chapters") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("lessons")
      .withIndex("by_chapter", (q) => q.eq("chapterId", args.chapterId))
      .order("asc")
      .collect();
  },
});

export const listAllLessons = query({
  args: { bookId: v.id("books") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("lessons")
      .withIndex("by_book", (q) => q.eq("bookId", args.bookId))
      .order("asc")
      .collect();
  },
});

export const listUserLessons = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];
    return await ctx.db
      .query("lessons")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
  },
});

export const get = query({
  args: { lessonId: v.id("lessons") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.lessonId);
  },
});

export const getLessonContext = query({
  args: { lessonId: v.id("lessons") },
  handler: async (ctx, args) => {
    const lesson = await ctx.db.get(args.lessonId);
    if (!lesson) return null;
    const chapter = await ctx.db.get(lesson.chapterId);
    const unit = chapter?.unitId ? await ctx.db.get(chapter.unitId) : null;
    const book = await ctx.db.get(lesson.bookId);
    const pages = await ctx.db
      .query("lessonPages")
      .withIndex("by_lesson", (q) => q.eq("lessonId", args.lessonId))
      .collect();
    const pageDetails = [];
    for (const lp of pages) {
      const page = await ctx.db.get(lp.pageId);
      if (page) pageDetails.push(page);
    }
    return { lesson, chapter, unit, book, pages: pageDetails };
  },
});
