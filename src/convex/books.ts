import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireUser, getCurrentUser } from "./helpers";

export const create = mutation({
  args: {
    title: v.string(),
    grade: v.number(),
    subject: v.string(),
    curriculum: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();
    const bookId = await ctx.db.insert("books", {
      userId: user._id,
      title: args.title,
      grade: args.grade,
      subject: args.subject,
      curriculum: args.curriculum,
      createdAt: now,
      updatedAt: now,
    });
    return bookId;
  },
});

export const listByUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];
    return await ctx.db
      .query("books")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .collect();
  },
});

export const get = query({
  args: { bookId: v.id("books") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.bookId);
  },
});

export const remove = mutation({
  args: { bookId: v.id("books") },
  handler: async (ctx, args) => {
    const book = await ctx.db.get(args.bookId);
    if (!book) throw new Error("Book not found");
    const pages = await ctx.db
      .query("pages")
      .withIndex("by_book", (q) => q.eq("bookId", args.bookId))
      .collect();
    for (const page of pages) {
      await ctx.db.delete(page._id);
    }
    const units = await ctx.db
      .query("units")
      .withIndex("by_book", (q) => q.eq("bookId", args.bookId))
      .collect();
    for (const unit of units) {
      const chapters = await ctx.db
        .query("chapters")
        .withIndex("by_unit", (q) => q.eq("unitId", unit._id))
        .collect();
      for (const chapter of chapters) {
        const lessons = await ctx.db
          .query("lessons")
          .withIndex("by_chapter", (q) => q.eq("chapterId", chapter._id))
          .collect();
        for (const lesson of lessons) {
          await ctx.db.delete(lesson._id);
        }
        await ctx.db.delete(chapter._id);
      }
      await ctx.db.delete(unit._id);
    }
    await ctx.db.delete(args.bookId);
    return { success: true };
  },
});
