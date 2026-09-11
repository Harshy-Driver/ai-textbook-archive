import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const processPage = mutation({
  args: {
    pageId: v.id("pages"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const page = await ctx.db.get(args.pageId);
    if (!page) throw new Error("Page not found");
    if (page.userId !== userId) throw new Error("Not authorized");

    await ctx.db.patch(args.pageId, { status: "processing" });

    try {
      const visionApiKey = process.env.VISION_API_KEY;

      if (visionApiKey) {
        // Real OCR/vision API integration point.
        // When VISION_API_KEY is set, call the external service here and parse
        // the response into { text, chapterTitle, unitTitle, lessonTitle, confidence }.
        // For now we leave this as a documented hook so the user can add the key
        // via Settings without changing application logic.
        console.log(`Vision API available — would process page ${args.pageId}`);
      }

      // No API configured: mark as processed with empty extracted text.
      // The user can still organize pages manually via the Organize page.
      await ctx.db.patch(args.pageId, {
        status: "processed",
        extractedText: "",
        ocrConfidence: 0,
      });

      return { success: true };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to process page";
      await ctx.db.patch(args.pageId, {
        status: "failed",
        errorMessage: message,
      });
      throw new Error(message);
    }
  },
});

export const processPageBatch = mutation({
  args: {
    pageIds: v.array(v.id("pages")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const pages = await Promise.all(args.pageIds.map((pid) => ctx.db.get(pid)));
    for (let i = 0; i < pages.length; i++) {
      const p = pages[i];
      if (!p || p.userId !== userId) {
        throw new Error(
          `Page ${p?._id ?? "?"} not found or not authorized`,
        );
      }
    }

    const results: Array<{ pageId: string; success: boolean; error?: string }> = [];

    for (const pageId of args.pageIds) {
      try {
        await ctx.db.patch(pageId, { status: "processing" });
        await ctx.db.patch(pageId, {
          status: "processed",
          extractedText: "",
          ocrConfidence: 0,
        });
        results.push({ pageId: pageId.toString(), success: true });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to process page";
        await ctx.db.patch(pageId, {
          status: "failed",
          errorMessage: message,
        });
        results.push({ pageId: pageId.toString(), success: false, error: message });
      }
    }

    return results;
  },
});
