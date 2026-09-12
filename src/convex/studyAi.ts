import { mutation, query, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { requireUser, getCurrentUser } from "./helpers";
import type { HighlightKind, HighlightPriority } from "../lib/highlights";

// Data functions for Smart Highlights & Study Files (queries + mutations only).
// AI actions live in studyAiActions.ts ("use node").

export type { HighlightKind, HighlightPriority };

export interface PageHighlight {
  id: string;
  text: string;
  priority: HighlightPriority;
  kind: HighlightKind;
  note?: string;
  source: "ai" | "user";
}

export type StudyBlock =
  | { kind: "paragraph"; text: string; sourcePage?: string }
  | { kind: "bullets"; items: string[]; sourcePage?: string }
  | { kind: "numbered"; items: string[]; sourcePage?: string }
  | { kind: "definition"; term: string; meaning: string; sourcePage?: string }
  | {
      kind: "formula";
      formula: string;
      symbols: string;
      units: string;
      whenToUse: string;
      example?: string;
      solution?: string;
      sourcePage?: string;
    }
  | { kind: "table"; headers: string[]; rows: string[][]; sourcePage?: string }
  | { kind: "check"; question: string; hint: string };

export interface StudyFileSection {
  id: string;
  type: string;
  title: string;
  blocks: StudyBlock[];
}

// ---------------------------------------------------------------------------
// Public queries & mutations
// ---------------------------------------------------------------------------

export const getPageAnalysis = query({
  args: { pageId: v.id("pages") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;
    const rows = await ctx.db
      .query("pageAnalysis")
      .withIndex("by_page", (q) => q.eq("pageId", args.pageId))
      .collect();
    const mine = rows.find((r) => r.userId === user._id);
    if (!mine) return null;
    return {
      ...mine,
      highlights: mine.highlights ? (JSON.parse(mine.highlights) as PageHighlight[]) : [],
    };
  },
});

export const saveHighlights = mutation({
  args: {
    pageId: v.id("pages"),
    highlights: v.array(
      v.object({
        text: v.string(),
        priority: v.string(),
        kind: v.string(),
        note: v.optional(v.string()),
        source: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const rows = await ctx.db
      .query("pageAnalysis")
      .withIndex("by_page", (q) => q.eq("pageId", args.pageId))
      .collect();
    const mine = rows.find((r) => r.userId === user._id);
    if (!mine) throw new Error("Run analysis for this page first");
    await ctx.db.patch(mine._id, {
      highlights: JSON.stringify(args.highlights),
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});

export const resetAiHighlights = mutation({
  args: { pageId: v.id("pages") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const rows = await ctx.db
      .query("pageAnalysis")
      .withIndex("by_page", (q) => q.eq("pageId", args.pageId))
      .collect();
    const mine = rows.find((r) => r.userId === user._id);
    if (!mine) return { success: true };
    const current = mine.highlights ? (JSON.parse(mine.highlights) as PageHighlight[]) : [];
    const kept = current.filter((h) => h.source === "user");
    await ctx.db.patch(mine._id, {
      highlights: JSON.stringify(kept),
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});

export const getPageStudy = query({
  args: { pageId: v.id("pages") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;
    const rows = await ctx.db
      .query("pageStudy")
      .withIndex("by_page", (q) => q.eq("pageId", args.pageId))
      .collect();
    const mine = rows.find((r) => r.userId === user._id);
    if (!mine) return null;
    return {
      _id: mine._id,
      updatedAt: mine.updatedAt,
      ...(JSON.parse(mine.panel) as {
        whatToKnow: string[];
        terms: { term: string; meaning: string }[];
        facts: string[];
        diagramInfo: string[];
        quickQuestions: string[];
      }),
    };
  },
});

export const listHighlightFlashcards = query({
  args: { pageId: v.optional(v.id("pages")) },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];
    if (args.pageId) {
      return await ctx.db
        .query("highlightFlashcards")
        .withIndex("by_page", (q) => q.eq("pageId", args.pageId!))
        .filter((q) => q.eq(q.field("userId"), user._id))
        .collect();
    }
    return await ctx.db
      .query("highlightFlashcards")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();
  },
});

export const saveHighlightFlashcards = mutation({
  args: {
    pageId: v.optional(v.id("pages")),
    cards: v.array(v.object({ front: v.string(), back: v.string() })),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (args.pageId) {
      const existing = await ctx.db
        .query("highlightFlashcards")
        .withIndex("by_page", (q) => q.eq("pageId", args.pageId!))
        .filter((q) => q.eq(q.field("userId"), user._id))
        .collect();
      for (const card of existing) await ctx.db.delete(card._id);
    }
    let count = 0;
    for (const c of args.cards.slice(0, 40)) {
      await ctx.db.insert("highlightFlashcards", {
        userId: user._id,
        pageId: args.pageId,
        source: "highlights",
        front: c.front,
        back: c.back,
        createdAt: Date.now(),
      });
      count++;
    }
    return { success: true, count };
  },
});

export const listStudyFiles = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];
    return await ctx.db
      .query("studyFiles")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();
  },
});

export const getStudyFile = query({
  args: { id: v.id("studyFiles") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;
    const file = await ctx.db.get(args.id);
    if (!file || file.userId !== user._id) return null;
    return {
      ...file,
      sections: JSON.parse(file.sections) as StudyFileSection[],
      pageIdList: JSON.parse(file.pageIds) as string[],
    };
  },
});

export const renameStudyFile = mutation({
  args: { id: v.id("studyFiles"), title: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const file = await ctx.db.get(args.id);
    if (!file || file.userId !== user._id) throw new Error("Not found");
    await ctx.db.patch(args.id, { title: args.title, updatedAt: Date.now() });
    return { success: true };
  },
});

export const removeStudyFile = mutation({
  args: { id: v.id("studyFiles") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const file = await ctx.db.get(args.id);
    if (!file || file.userId !== user._id) throw new Error("Not found");
    await ctx.db.delete(args.id);
    return { success: true };
  },
});

export const getPagesMeta = query({
  args: { pageIds: v.array(v.id("pages")) },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];
    const out: Array<{
      pageId: string;
      imageUrl: string;
      pageNumber: number | null;
      position: number;
    }> = [];
    for (const pid of args.pageIds.slice(0, 12)) {
      const p = await ctx.db.get(pid);
      if (!p || p.userId !== user._id) continue;
      const analysisRows = await ctx.db
        .query("pageAnalysis")
        .withIndex("by_page", (q) => q.eq("pageId", pid))
        .collect();
      const mine = analysisRows.find((r) => r.userId === user._id);
      out.push({
        pageId: String(pid),
        imageUrl: p.imageUrl,
        pageNumber: mine?.pageNumber ?? null,
        position: out.length + 1,
      });
    }
    return out;
  },
});

// ---------------------------------------------------------------------------
// Internal helpers used by actions in studyAiActions.ts
// ---------------------------------------------------------------------------

export const getCachedAnalysis = internalQuery({
  args: { userId: v.id("users"), textHash: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("pageAnalysis")
      .withIndex("by_user_hash", (q) =>
        q.eq("userId", args.userId).eq("textHash", args.textHash),
      )
      .first();
  },
});

export const getPageAnalysisRows = internalQuery({
  args: { pageId: v.id("pages"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("pageAnalysis")
      .withIndex("by_page", (q) => q.eq("pageId", args.pageId))
      .collect();
    return rows.filter((r) => r.userId === args.userId);
  },
});

export const getPageDoc = internalQuery({
  args: { pageId: v.id("pages") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.pageId);
  },
});

export const getBookDoc = internalQuery({
  args: { bookId: v.id("books") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.bookId);
  },
});

export const touchPage = internalMutation({
  args: {
    pageId: v.id("pages"),
    status: v.union(
      v.literal("processing"),
      v.literal("processed"),
      v.literal("unreadable"),
      v.literal("failed"),
    ),
    extractedText: v.optional(v.string()),
    ocrConfidence: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const page = await ctx.db.get(args.pageId);
    if (!page) return { success: false };
    await ctx.db.patch(args.pageId, {
      status: args.status,
      extractedText: args.extractedText ?? page.extractedText,
      ocrConfidence: args.ocrConfidence ?? page.ocrConfidence,
    });
    return { success: true };
  },
});

export const patchAnalysis = internalMutation({
  args: {
    id: v.id("pageAnalysis"),
    doc: v.any(),
  },
  handler: async (ctx, args) => {
    const { id, doc } = args;
    await ctx.db.patch(id, doc);
    return { success: true };
  },
});

export const insertAnalysis = internalMutation({
  args: { doc: v.any() },
  handler: async (ctx, args) => {
    await ctx.db.insert("pageAnalysis", args.doc);
    return { success: true };
  },
});

export const insertStudyFile = internalMutation({
  args: { doc: v.any() },
  handler: async (ctx, args) => {
    return await ctx.db.insert("studyFiles", args.doc);
  },
});

export const savePageStudyInternal = internalMutation({
  args: { userId: v.id("users"), pageId: v.id("pages"), panel: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("pageStudy")
      .withIndex("by_page", (q) => q.eq("pageId", args.pageId))
      .collect();
    const mine = rows.find((r) => r.userId === args.userId);
    if (mine) {
      await ctx.db.patch(mine._id, { panel: args.panel, updatedAt: Date.now() });
    } else {
      await ctx.db.insert("pageStudy", {
        userId: args.userId,
        pageId: args.pageId,
        panel: args.panel,
        updatedAt: Date.now(),
      });
    }
    return { success: true };
  },
});

export const saveHighlightCardsInternal = internalMutation({
  args: {
    userId: v.id("users"),
    pageId: v.optional(v.id("pages")),
    cards: v.array(v.object({ front: v.string(), back: v.string() })),
  },
  handler: async (ctx, args) => {
    if (args.pageId) {
      const existing = await ctx.db
        .query("highlightFlashcards")
        .withIndex("by_page", (q) => q.eq("pageId", args.pageId!))
        .filter((q) => q.eq(q.field("userId"), args.userId))
        .collect();
      for (const card of existing) await ctx.db.delete(card._id);
    }
    let count = 0;
    for (const c of args.cards.slice(0, 40)) {
      await ctx.db.insert("highlightFlashcards", {
        userId: args.userId,
        pageId: args.pageId,
        source: "highlights",
        front: c.front,
        back: c.back,
        createdAt: Date.now(),
      });
      count++;
    }
    return { success: true, count };
  },
});

export const getUserDoc = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

export const getStudyFileRow = internalQuery({
  args: { studyFileId: v.id("studyFiles") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.studyFileId);
  },
});

export const touchStudyFile = internalMutation({
  args: { studyFileId: v.id("studyFiles") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.studyFileId, { updatedAt: Date.now() });
    return { success: true };
  },
});

export const patchPageStructure = internalMutation({
  args: {
    pageId: v.id("pages"),
    unitTitle: v.optional(v.string()),
    chapterTitle: v.optional(v.string()),
    lessonTitle: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.pageId, {
      unitTitle: args.unitTitle,
      chapterTitle: args.chapterTitle,
      lessonTitle: args.lessonTitle,
    });
    return { success: true };
  },
});

export const getLessonDoc = internalQuery({
  args: { lessonId: v.id("lessons") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.lessonId);
  },
});

export const listLessonPages = internalQuery({
  args: { lessonId: v.id("lessons") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("lessonPages")
      .withIndex("by_lesson", (q) => q.eq("lessonId", args.lessonId))
      .collect();
  },
});

export const updateLessonFields = internalMutation({
  args: {
    lessonId: v.id("lessons"),
    summary: v.optional(v.string()),
    keyTerms: v.optional(v.string()),
    formulas: v.optional(v.string()),
    objectives: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.lessonId, {
      summary: args.summary,
      keyTerms: args.keyTerms,
      formulas: args.formulas,
      objectives: args.objectives,
    });
    return { success: true };
  },
});

export const clearLessonInfo = internalMutation({
  args: { lessonId: v.id("lessons") },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("lessonInfo")
      .withIndex("by_lesson_user", (q) => q.eq("lessonId", args.lessonId))
      .collect();
    for (const row of rows) await ctx.db.delete(row._id);
    return { success: true };
  },
});

export const insertLessonInfo = internalMutation({
  args: {
    userId: v.id("users"),
    lessonId: v.id("lessons"),
    level: v.union(v.literal("must_know"), v.literal("important"), v.literal("extra")),
    content: v.string(),
    order: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("lessonInfo", args);
    return { success: true };
  },
});

// ---- Lesson-from-pages helpers (called by createLessonFromPages action) ----

export const nextLessonOrder = internalQuery({
  args: { bookId: v.id("books") },
  handler: async (ctx, args) => {
    const lessons = await ctx.db
      .query("lessons")
      .withIndex("by_book", (q) => q.eq("bookId", args.bookId))
      .collect();
    return lessons.length;
  },
});

/** Find the book's first chapter, or create one when the book has none. */
export const ensureChapter = internalMutation({
  args: {
    userId: v.id("users"),
    bookId: v.id("books"),
    title: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("chapters")
      .withIndex("by_book", (q) => q.eq("bookId", args.bookId))
      .collect();
    if (existing.length > 0) {
      return existing.sort((a, b) => a.order - b.order)[0]._id;
    }
    return await ctx.db.insert("chapters", {
      userId: args.userId,
      bookId: args.bookId,
      title: args.title ?? "My Textbook Pages",
      order: 0,
    });
  },
});

export const insertLessonRow = internalMutation({
  args: {
    userId: v.id("users"),
    bookId: v.id("books"),
    chapterId: v.id("chapters"),
    title: v.string(),
    order: v.number(),
    summary: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("lessons", {
      userId: args.userId,
      bookId: args.bookId,
      chapterId: args.chapterId,
      title: args.title,
      order: args.order,
      summary: args.summary,
    });
  },
});

export const linkPageToLesson = internalMutation({
  args: {
    lessonId: v.id("lessons"),
    pageId: v.id("pages"),
    order: v.number(),
  },
  handler: async (ctx, args) => {
    // Avoid duplicate links
    const existing = await ctx.db
      .query("lessonPages")
      .withIndex("by_lesson", (q) => q.eq("lessonId", args.lessonId))
      .collect();
    if (existing.some((lp) => lp.pageId === args.pageId)) return { success: false };
    await ctx.db.insert("lessonPages", {
      lessonId: args.lessonId,
      pageId: args.pageId,
      order: args.order,
    });
    return { success: true };
  },
});

/** Detected lesson titles from pages' own lessonTitle fields, in page order. */
export const getPageTitles = internalQuery({
  args: { pageIds: v.array(v.id("pages")) },
  handler: async (ctx, args) => {
    const titles: Array<string | null> = [];
    for (const pageId of args.pageIds.slice(0, 12)) {
      const page = await ctx.db.get(pageId);
      titles.push(page?.lessonTitle ?? null);
    }
    return titles;
  },
});

export const getPageStudyInternal = internalQuery({
  args: { pageId: v.id("pages"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("pageStudy")
      .withIndex("by_page", (q) => q.eq("pageId", args.pageId))
      .collect();
    return rows.find((r) => r.userId === args.userId)?._id ?? null;
  },
});
