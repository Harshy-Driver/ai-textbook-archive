import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

function extractVisionText(imageUrl: string, apiKey: string): Promise<string> {
  // Placeholder for real vision/OCR API call.
  // Replace this implementation with a call to your preferred provider
  // (e.g. Google Vision, AWS Textract, OCR.space) using `imageUrl`.
  // The response should be plain text extracted from the page image.
  return Promise.resolve("");
}

function detectPageStructure(
  text: string,
): {
  chapterTitle: string;
  unitTitle: string;
  lessonTitle: string;
  confidence: number;
} {
  // Structural detection heuristics.
  // In version 1 this is a simple keyword-based guess; when an API key is
  // configured the real vision response should include these fields directly.
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const chapterTitle = lines.find((l) => /chapter|unit\s+\d/i.test(l)) ?? "Chapter";
  const lessonTitle = lines.find((l) => /lesson\s+\d/i.test(l)) ?? "Lesson";
  const unitTitle = "Unit";
  const confidence = text.length > 50 ? 0.7 : 0.2;
  return { chapterTitle, unitTitle, lessonTitle, confidence };
}

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
      let extractedText = "";

      if (visionApiKey && visionApiKey.trim()) {
        extractedText = await extractVisionText(page.imageUrl, visionApiKey);
      } else {
        // No API configured yet — store a placeholder so the page is marked
        // readable but the user still needs to add the key for real OCR.
        extractedText = "[OCR not configured: add VISION_API_KEY to enable text extraction]";
      }

      const { chapterTitle, unitTitle, lessonTitle, confidence } =
        detectPageStructure(extractedText);

      await ctx.db.patch(args.pageId, {
        status: "processed",
        extractedText,
        ocrConfidence: confidence,
        chapterTitle,
        unitTitle,
        lessonTitle,
      });

      return { success: true, confidence };
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
        const page = await ctx.db.get(pageId);
        if (!page) {
          throw new Error("Page not found");
        }
        await ctx.db.patch(pageId, { status: "processing" });

        const visionApiKey = process.env.VISION_API_KEY;
        let extractedText = "";

        if (visionApiKey && visionApiKey.trim()) {
          extractedText = await extractVisionText(page.imageUrl, visionApiKey);
        } else {
          extractedText =
            "[OCR not configured: add VISION_API_KEY to enable text extraction]";
        }

        const { chapterTitle, unitTitle, lessonTitle, confidence } =
          detectPageStructure(extractedText);

        await ctx.db.patch(pageId, {
          status: "processed",
          extractedText,
          ocrConfidence: confidence,
          chapterTitle,
          unitTitle,
          lessonTitle,
        });

        results.push({ pageId: pageId.toString(), success: true, error: undefined });
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
