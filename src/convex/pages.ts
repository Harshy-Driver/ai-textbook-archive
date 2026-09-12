import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireUser, getCurrentUser } from "./helpers";
import type { Id } from "./_generated/dataModel";

export const upload = mutation({
  args: {
    bookId: v.id("books"),
    imageUrl: v.string(),
    order: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const pageId = await ctx.db.insert("pages", {
      userId: user._id,
      bookId: args.bookId,
      imageUrl: args.imageUrl,
      order: args.order,
      status: "uploading",
      createdAt: Date.now(),
    });
    return pageId;
  },
});

export const updateStatus = mutation({
  args: {
    pageId: v.id("pages"),
    status: v.union(
      v.literal("uploading"),
      v.literal("processing"),
      v.literal("processed"),
      v.literal("failed"),
      v.literal("unreadable"),
    ),
    extractedText: v.optional(v.string()),
    ocrConfidence: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    chapterTitle: v.optional(v.string()),
    unitTitle: v.optional(v.string()),
    lessonTitle: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { pageId, ...updates } = args;
    await ctx.db.patch(pageId, updates);
    return { success: true };
  },
});

export const updateOrder = mutation({
  args: {
    pageId: v.id("pages"),
    order: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.pageId, { order: args.order });
    return { success: true };
  },
});

export const remove = mutation({
  args: { pageId: v.id("pages") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.pageId);
    return { success: true };
  },
});

export const listByBook = query({
  args: { bookId: v.id("books") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("pages")
      .withIndex("by_book", (q) => q.eq("bookId", args.bookId))
      .order("asc")
      .collect();
  },
});

export const listByUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];
    return await ctx.db
      .query("pages")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();
  },
});

// ---------------------------------------------------------------------------
// Ownership recovery: the app supports anonymous + email auth, so content can
// end up owned by a throwaway anonymous session. These helpers let the
// signed-in user reclaim anonymous-owned content in a book.
// ---------------------------------------------------------------------------

export const getPageOwnership = query({
  args: { pageId: v.id("pages") },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return { mine: false, claimable: false, signedIn: false };
    const page = await ctx.db.get(args.pageId);
    if (!page) return { mine: false, claimable: false, signedIn: true };
    if (page.userId === user._id) return { mine: true, claimable: false, signedIn: true };
    const owner = await ctx.db.get(page.userId);
    return {
      mine: false,
      claimable: !!owner?.isAnonymous,
      signedIn: true,
    };
  },
});

/**
 * Reassign a book and all of its anonymous-owned content (pages, structure,
 * lesson data, cached AI analyses) to the current user. Content owned by
 * another real (non-anonymous) account is never touched.
 */
export const claimBookContent = mutation({
  args: { bookId: v.id("books") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const book = await ctx.db.get(args.bookId);
    if (!book) throw new Error("Book not found");

    let claimed = 0;
    // Only anonymous rows are reclaimable — never another real account.
    const previousOwners = new Set<Id<"users">>();

    if (book.userId !== user._id) {
      const owner = await ctx.db.get(book.userId);
      if (!owner?.isAnonymous) {
        throw new Error("This book belongs to a different account");
      }
      previousOwners.add(book.userId);
      await ctx.db.patch(book._id, { userId: user._id, updatedAt: Date.now() });
      claimed++;
    }

    const pages = await ctx.db
      .query("pages")
      .withIndex("by_book", (q) => q.eq("bookId", args.bookId))
      .collect();
    const pageIds: Id<"pages">[] = [];
    for (const p of pages) {
      pageIds.push(p._id);
      if (p.userId !== user._id && !previousOwners.has(p.userId)) {
        const owner = await ctx.db.get(p.userId);
        if (!owner?.isAnonymous) continue; // leave other real users' pages alone
        previousOwners.add(p.userId);
      }
      if (p.userId !== user._id) {
        await ctx.db.patch(p._id, { userId: user._id });
        claimed++;
      }
    }

    // Cached per-page AI artifacts owned by the previous anonymous session
    for (const pid of pageIds) {
      const analyses = await ctx.db
        .query("pageAnalysis")
        .withIndex("by_page", (q) => q.eq("pageId", pid))
        .collect();
      for (const r of analyses) {
        if (previousOwners.has(r.userId)) {
          await ctx.db.patch(r._id, { userId: user._id });
          claimed++;
        }
      }
      const studies = await ctx.db
        .query("pageStudy")
        .withIndex("by_page", (q) => q.eq("pageId", pid))
        .collect();
      for (const s of studies) {
        if (previousOwners.has(s.userId)) await ctx.db.patch(s._id, { userId: user._id });
      }
      const cards = await ctx.db
        .query("highlightFlashcards")
        .withIndex("by_page", (q) => q.eq("pageId", pid))
        .collect();
      for (const c of cards) {
        if (previousOwners.has(c.userId)) await ctx.db.patch(c._id, { userId: user._id });
      }
    }

    // Structure + lesson data created under the previous anonymous session
    const units = await ctx.db
      .query("units")
      .withIndex("by_book", (q) => q.eq("bookId", args.bookId))
      .collect();
    for (const u of units) {
      if (previousOwners.has(u.userId)) await ctx.db.patch(u._id, { userId: user._id });
    }
    const chapters = await ctx.db
      .query("chapters")
      .withIndex("by_book", (q) => q.eq("bookId", args.bookId))
      .collect();
    for (const ch of chapters) {
      if (previousOwners.has(ch.userId)) await ctx.db.patch(ch._id, { userId: user._id });
    }
    const lessons = await ctx.db
      .query("lessons")
      .withIndex("by_book", (q) => q.eq("bookId", args.bookId))
      .collect();
    for (const l of lessons) {
      if (!previousOwners.has(l.userId)) continue;
      await ctx.db.patch(l._id, { userId: user._id });
      const infos = await ctx.db
        .query("lessonInfo")
        .withIndex("by_lesson_user", (q) => q.eq("lessonId", l._id).eq("userId", l.userId))
        .collect();
      for (const info of infos) await ctx.db.patch(info._id, { userId: user._id });
      const checks = await ctx.db
        .query("studyChecklist")
        .withIndex("by_lesson_user", (q) => q.eq("lessonId", l._id).eq("userId", l.userId))
        .collect();
      for (const c of checks) await ctx.db.patch(c._id, { userId: user._id });
    }

    return { claimed };
  },
});
