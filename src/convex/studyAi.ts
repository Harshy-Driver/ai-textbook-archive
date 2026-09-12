import { action, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireUser, getCurrentUser } from "./helpers";
import { callAI, aiKeyConfigured, extractJson, hashString } from "./aiClient";
import type { Doc, Id } from "./_generated/dataModel";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type HighlightPriority = "high" | "medium" | "low";
export type HighlightKind =
  | "definition"
  | "concept"
  | "law"
  | "formula"
  | "equation"
  | "fact"
  | "vocabulary"
  | "process"
  | "step"
  | "cause_effect"
  | "example"
  | "exam_relevant"
  | "diagram_label"
  | "comparison"
  | "objective"
  | "custom";

export interface PageHighlight {
  id: string;
  // Exact substring of the page transcription. Must appear verbatim in fullText.
  text: string;
  priority: HighlightPriority;
  kind: HighlightKind;
  note?: string;
  source: "ai" | "user";
}

export interface HighlightsPayload {
  fullText: string;
  pageNumber: number | null;
  ocrConfidence: number;
  readability: "clear" | "partially_readable" | "unreadable";
  readabilityNote: string | null;
  highlights: PageHighlight[];
}

export interface StudyFileSection {
  id: string;
  type:
    | "about"
    | "must_know"
    | "definitions"
    | "facts"
    | "formulas"
    | "processes"
    | "diagrams"
    | "examples"
    | "mistakes"
    | "quick_review"
    | "check_yourself"
    | "chapter_overview"
    | "lessons_list";
  title: string;
  // Simple structured content blocks for rendering + export
  blocks: Array<
    | { kind: "paragraph"; text: string; sourcePage?: string | null }
    | { kind: "bullets"; items: string[]; sourcePage?: string | null }
    | { kind: "numbered"; items: string[]; sourcePage?: string | null }
    | {
        kind: "definition";
        term: string;
        meaning: string;
        sourcePage?: string | null;
      }
    | {
        kind: "formula";
        formula: string;
        symbols: string;
        units: string;
        whenToUse: string;
        example?: string;
        solution?: string;
        sourcePage?: string | null;
      }
    | {
        kind: "table";
        headers: string[];
        rows: string[][];
        sourcePage?: string | null;
      }
    | {
        kind: "check";
        question: string;
        hint: string;
        sourcePage?: string | null;
      }
  >;
}

// ---------------------------------------------------------------------------
// Validation helper
// ---------------------------------------------------------------------------

function normalizeHighlights(
  raw: unknown,
  fullText: string,
): PageHighlight[] {
  const out: PageHighlight[] = [];
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  let n = 0;
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const rec = item as Record<string, unknown>;
    const text = typeof rec.text === "string" ? rec.text.trim() : "";
    if (text.length < 2) continue;
    // The highlight must appear in the transcription exactly — never invent text.
    if (!fullText.includes(text)) continue;
    const priorityRaw = String(rec.priority || "medium").toLowerCase();
    const priority: HighlightPriority =
      priorityRaw === "high" ? "high" : priorityRaw === "low" ? "low" : "medium";
    const kindRaw = String(rec.kind || "concept").toLowerCase();
    const allowedKinds: HighlightKind[] = [
      "definition", "concept", "law", "formula", "equation", "fact",
      "vocabulary", "process", "step", "cause_effect", "example",
      "exam_relevant", "diagram_label", "comparison", "objective", "custom",
    ];
    const kind: HighlightKind = allowedKinds.includes(kindRaw as HighlightKind)
      ? (kindRaw as HighlightKind)
      : "concept";
    const note = typeof rec.note === "string" ? rec.note.slice(0, 400) : undefined;
    // Truncate overly long highlights (avoid highlighting whole pages)
    const clipped = text.length > 400 ? text.slice(0, 400) : text;
    const dedupeKey = clipped.slice(0, 120).toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    out.push({
      id: `h${Date.now().toString(36)}${n}${Math.floor(Math.random() * 1e4).toString(36)}`,
      text: clipped,
      priority,
      kind,
      note,
      source: "ai",
    });
    n++;
    if (out.length >= 40) break;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Queries & simple mutations
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
    return JSON.parse(mine.panel) as {
      whatToKnow: string[];
      terms: { term: string; meaning: string }[];
      facts: string[];
      diagramInfo: string[];
      quickQuestions: string[];
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
    // Replace previous cards for this page
    if (args.pageId) {
      const existing = await ctx.db
        .query("highlightFlashcards")
        .withIndex("by_page", (q) => q.eq("pageId", args.pageId!))
        .filter((q) => q.eq(q.field("userId"), user._id))
        .collect();
      for (const card of existing) await ctx.db.delete(card._id);
    }
    const ids = [];
    for (const c of args.cards.slice(0, 40)) {
      const id = await ctx.db.insert("highlightFlashcards", {
        userId: user._id,
        pageId: args.pageId,
        source: "highlights",
        front: c.front,
        back: c.back,
        createdAt: Date.now(),
      });
      ids.push(id);
    }
    return { success: true, count: ids.length };
  },
});

// ---------------------------------------------------------------------------
// AI Actions
// ---------------------------------------------------------------------------

const HIGHLIGHT_SYSTEM_PROMPT = `You are a precise OCR and study-assistant engine for UAE Grade 9-11 Physics and Biology textbooks (English).
You will be shown ONE photo of a textbook page. You must:
1. Transcribe EXACTLY the text visible on the page, preserving reading order, section titles, numbers, formulas and diagram labels. Do NOT paraphrase, fix, complete or invent anything. If a word is unreadable write [illegible].
2. Report the printed page number ONLY if it is actually visible; otherwise null.
3. Judge readability: "clear", "partially_readable" or "unreadable".
4. Select ONLY genuinely important snippets (usually 5-15, max 20) for study highlighting: definitions, key concepts, laws, formulas, equations, important facts, vocabulary, processes, steps, cause-effect statements, important examples, diagram labels, comparisons, learning objectives. Copy each snippet EXACTLY from your transcription (verbatim substring). NEVER highlight whole paragraphs or more than ~40 words per snippet. If you cannot confidently identify something, do not include it.

Respond with ONLY JSON in exactly this shape:
{
  "fullText": "exact transcription with \\n line breaks",
  "pageNumber": 47 or null,
  "ocrConfidence": 0.0-1.0,
  "readability": "clear" | "partially_readable" | "unreadable",
  "readabilityNote": "one short sentence about problems, or empty string",
  "highlights": [
    { "text": "verbatim snippet from fullText", "priority": "high" | "medium" | "low", "kind": "definition|concept|law|formula|equation|fact|vocabulary|process|step|cause_effect|example|exam_relevant|diagram_label|comparison|objective", "note": "why it matters (optional, max 15 words)" }
  ]
}`;

export const analyzePage = action({
  args: {
    pageId: v.id("pages"),
    imageUrl: v.string(),
    intensity: v.optional(v.union(v.literal("light"), v.literal("balanced"), v.literal("exam_focus"))),
  },
  handler: async (ctx, args): Promise<HighlightsPayload> => {
    const user = await requireUser(ctx);
    const page = await ctx.runQuery(api_pagesGet, { pageId: args.pageId });
    if (!page) throw new Error("Page not found");
    if (page.userId !== user._id) throw new Error("Not authorized");

    const textHash = hashString(args.imageUrl.slice(0, 200000));

    // Cache: same image content -> reuse saved analysis
    const cached = await ctx.runQuery(apiCachedAnalysis, { userId: user._id, textHash });
    if (cached) {
      await ctx.runMutation(apiTouchPage, { pageId: args.pageId, status: "processed" });
      return {
        fullText: cached.fullText,
        pageNumber: cached.pageNumber ?? null,
        ocrConfidence: cached.ocrConfidence,
        readability: cached.readability,
        readabilityNote: cached.readabilityNote ?? null,
        highlights: cached.highlights ? (JSON.parse(cached.highlights) as PageHighlight[]) : [],
      };
    }

    if (!aiKeyConfigured()) {
      throw new Error(
        "AI is not configured. Add the VLY_INTEGRATION_KEY in the Keys/API keys tab to enable page analysis.",
      );
    }

    const intensityLine =
      args.intensity === "light"
        ? "STUDY INTENSITY: light — only the most essential information."
        : args.intensity === "exam_focus"
          ? "STUDY INTENSITY: exam focus — prioritise information most likely to require detailed understanding, calculations, definitions, processes and application."
          : "STUDY INTENSITY: balanced — important concepts plus useful supporting information.";

    const raw = await callAI(
      [
        { role: "system", content: `${HIGHLIGHT_SYSTEM_PROMPT}\n\n${intensityLine}` },
        {
          role: "user",
          content: [
            { type: "text", text: "Analyse this textbook page photo now." },
            { type: "image_url", image_url: { url: args.imageUrl } },
          ],
        },
      ],
      { maxTokens: 3000, temperature: 0 },
    );

    const parsed = extractJson<{
      fullText?: string;
      pageNumber?: number | null;
      ocrConfidence?: number;
      readability?: string;
      readabilityNote?: string;
      highlights?: unknown[];
    }>(raw);

    const fullText = typeof parsed.fullText === "string" ? parsed.fullText : "";
    const readability =
      parsed.readability === "clear" || parsed.readability === "partially_readable" || parsed.readability === "unreadable"
        ? parsed.readability
        : "partially_readable";
    const highlights = normalizeHighlights(parsed.highlights, fullText);

    // If the model already produced a pageAnalysis row for this page, update it.
    const existingRows = await ctx.runQuery(apiPageAnalysisRows, { pageId: args.pageId, userId: user._id });
    const payload = {
      userId: user._id,
      pageId: args.pageId,
      textHash,
      fullText,
      pageNumber: typeof parsed.pageNumber === "number" ? parsed.pageNumber : undefined,
      ocrConfidence: typeof parsed.ocrConfidence === "number" ? parsed.ocrConfidence : 0.5,
      readability,
      readabilityNote: parsed.readabilityNote || undefined,
      highlights: JSON.stringify(highlights),
      updatedAt: Date.now(),
    };
    if (existingRows.length > 0) {
      await ctx.runMutation(apiPatchAnalysis, { id: existingRows[0]._id, patch: payload });
    } else {
      await ctx.runMutation(apiInsertAnalysis, { doc: payload });
    }
    await ctx.runMutation(apiTouchPage, {
      pageId: args.pageId,
      status: readability === "unreadable" ? "unreadable" : "processed",
      extractedText: fullText,
      ocrConfidence: payload.ocrConfidence,
    });

    return {
      fullText,
      pageNumber: payload.pageNumber ?? null,
      ocrConfidence: payload.ocrConfidence,
      readability,
      readabilityNote: payload.readabilityNote ?? null,
      highlights,
    };
  },
});

// Internal function refs resolved at runtime to avoid circular imports.
// These are small wrapper mutations/queries defined at the bottom of this file.
import { api as apiRef } from "./_generated/api";
const api_pagesGet = (apiRef as any).pages.get;
const apiCachedAnalysis = (apiRef as any).studyAi.getCachedAnalysis;
const apiTouchPage = (apiRef as any).studyAi.touchPage;
const apiPageAnalysisRows = (apiRef as any).studyAi.getPageAnalysisRows;
const apiPatchAnalysis = (apiRef as any).studyAi.patchAnalysis;
const apiInsertAnalysis = (apiRef as any).studyAi.insertAnalysis;

export const getCachedAnalysis = query({
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

export const getPageAnalysisRows = query({
  args: { pageId: v.id("pages"), userId: v.id("users") },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("pageAnalysis")
      .withIndex("by_page", (q) => q.eq("pageId", args.pageId))
      .collect();
    return rows.filter((r) => r.userId === args.userId);
  },
});

export const touchPage = mutation({
  args: {
    pageId: v.id("pages"),
    status: v.union(v.literal("processing"), v.literal("processed"), v.literal("unreadable")),
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

export const patchAnalysis = mutation({
  args: {
    id: v.id("pageAnalysis"),
    patch: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, args.patch);
    return { success: true };
  },
});

export const insertAnalysis = mutation({
  args: { doc: v.any() },
  handler: async (ctx, args) => {
    await ctx.db.insert("pageAnalysis", args.doc);
    return { success: true };
  },
});

// ---------------------------------------------------------------------------
// Study file generation
// ---------------------------------------------------------------------------

const STUDY_FILE_PROMPT = `You create clean, structured revision documents for UAE Grade 9-11 Physics/Biology students, based ONLY on textbook page transcriptions you are given.
Rules:
- Base every statement on the transcriptions. Clearly mark anything you add as general explanation with the prefix "[AI explanation]".
- NEVER invent page numbers. Use the "Page N" label given with each transcription.
- If the transcriptions lack content for a section, return an empty items array for it.
- Keep the document short and easy to revise. No filler.
- For Physics formulas use the exact formula from the transcription, name every symbol, give SI units, when to use it, and a worked example with a mathematically correct solution (verify the arithmetic).
- For Biology processes use numbered steps.

Respond with ONLY JSON:
{
  "title": "Lesson/chapter title from the textbook, or a short descriptive title",
  "sections": [
    { "type": "about", "title": "What This Lesson Is About", "blocks": [
        { "kind": "paragraph", "text": "..." } ] },
    { "type": "must_know", "title": "Must Know", "blocks": [ { "kind": "bullets", "items": ["..."], "sourcePage": "Page 47" } ] },
    { "type": "definitions", "title": "Key Definitions", "blocks": [ { "kind": "definition", "term": "...", "meaning": "...", "sourcePage": "Page 47" } ] },
    { "type": "facts", "title": "Important Facts", "blocks": [ { "kind": "bullets", "items": ["..."] } ] },
    { "type": "formulas", "title": "Important Formulas", "blocks": [ { "kind": "formula", "formula": "...", "symbols": "...", "units": "...", "whenToUse": "...", "example": "...", "solution": "..." } ] },
    { "type": "processes", "title": "Important Processes", "blocks": [ { "kind": "numbered", "items": ["..."] } ] },
    { "type": "diagrams", "title": "Important Diagrams", "blocks": [ { "kind": "paragraph", "text": "...", "sourcePage": "Page 47" } ] },
    { "type": "examples", "title": "Examples", "blocks": [ { "kind": "paragraph", "text": "..." } ] },
    { "type": "mistakes", "title": "Common Mistakes", "blocks": [ { "kind": "bullets", "items": ["..."] } ] },
    { "type": "quick_review", "title": "Quick Review", "blocks": [ { "kind": "bullets", "items": ["..."] } ] },
    { "type": "check_yourself", "title": "Check Yourself", "blocks": [ { "kind": "check", "question": "...", "hint": "..." } ] }
  ]
}
Section types available: about, must_know, definitions, facts, formulas, processes, diagrams, examples, mistakes, quick_review, check_yourself (plus chapter_overview and lessons_list when asked). Include only relevant ones.`;

export const generateStudyFile = action({
  args: {
    pageIds: v.array(v.id("pages")),
    scope: v.union(v.literal("lesson"), v.literal("page"), v.literal("pages"), v.literal("chapter")),
    titleOverride: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ studyFileId: Id<"studyFiles"> }> => {
    const user = await requireUser(ctx);
    if (args.pageIds.length === 0) throw new Error("Select at least one page");

    // Load pages + cached analyses (never reprocess)
    const pages: Array<{ id: string; label: string; text: string; order: number }> = [];
    let book: Doc<"books"> | null = null;
    for (const pageId of args.pageIds) {
      const page: Doc<"pages"> | null = await ctx.runQuery(api_pagesGet, { pageId });
      if (!page || page.userId !== user._id) continue;
      if (!book) book = await ctx.db.get(page.bookId);
      const analysisRows = await ctx.runQuery(apiPageAnalysisRows, { pageId, userId: user._id });
      const analysis = analysisRows[0];
      const label = analysis?.pageNumber ? `Page ${analysis.pageNumber}` : `Uploaded page ${pages.length + 1}`;
      const text = analysis?.fullText || page.extractedText || "";
      pages.push({ id: String(pageId), label, text, order: page.order });
    }
    if (pages.length === 0) throw new Error("No readable pages found. Analyse your pages first.");
    const unanalysed = pages.filter((p) => !p.text.trim());
    if (unanalysed.length === pages.length) {
      throw new Error(
        "The selected pages have not been analysed yet. Use 'Highlight Important Things' on a page first.",
      );
    }

    pages.sort((a, b) => a.order - b.order);
    const transcript = pages
      .map((p) => `--- [${p.label}] ---\n${p.text.slice(0, 6000)}`)
      .join("\n\n");

    if (!aiKeyConfigured()) {
      throw new Error("AI is not configured. Add VLY_INTEGRATION_KEY in the Keys/API keys tab.");
    }

    const scopeLine =
      args.scope === "chapter"
        ? `The student uploaded a WHOLE CHAPTER (${pages.length} pages). Additionally include a "chapter_overview" section (type: chapter_overview) with an overview paragraph, and a "lessons_list" section (type: lessons_list) listing the lessons/sections detected in the transcriptions as bullets with their page labels.`
        : args.scope === "pages"
          ? `The student uploaded ${pages.length} pages to combine into ONE organized study guide.`
          : "The student uploaded page(s) for one lesson.";

    const raw = await callAI(
      [
        { role: "system", content: `${STUDY_FILE_PROMPT}\n\n${scopeLine}` },
        {
          role: "user",
          content: `Create the study file from these textbook transcriptions:\n\n${transcript}`,
        },
      ],
      { maxTokens: 4000, temperature: 0.2 },
    );

    const parsed = extractJson<{ title?: string; sections?: unknown[] }>(raw);
    const sections: StudyFileSection[] = [];
    let i = 0;
    for (const s of Array.isArray(parsed.sections) ? parsed.sections : []) {
      const rec = s as Record<string, unknown>;
      const type = String(rec.type || "facts");
      const title = String(rec.title || "Section");
      const blocksRaw = Array.isArray(rec.blocks) ? rec.blocks : [];
      const blocks: StudyFileSection["blocks"] = [];
      for (const b of blocksRaw) {
        const br = b as Record<string, unknown>;
        const kind = String(br.kind || "");
        const src = typeof br.sourcePage === "string" ? br.sourcePage : undefined;
        if (kind === "paragraph" && typeof br.text === "string") {
          blocks.push({ kind: "paragraph", text: br.text.slice(0, 1200), sourcePage: src ?? null });
        } else if ((kind === "bullets" || kind === "numbered") && Array.isArray(br.items)) {
          const items = br.items.filter((x): x is string => typeof x === "string").slice(0, 14);
          if (items.length) blocks.push({ kind, items, sourcePage: src ?? null });
        } else if (kind === "definition" && typeof br.term === "string" && typeof br.meaning === "string") {
          blocks.push({ kind: "definition", term: br.term, meaning: br.meaning, sourcePage: src ?? null });
        } else if (kind === "formula") {
          blocks.push({
            kind: "formula",
            formula: String(br.formula || ""),
            symbols: String(br.symbols || ""),
            units: String(br.units || ""),
            whenToUse: String(br.whenToUse || ""),
            example: typeof br.example === "string" ? br.example : undefined,
            solution: typeof br.solution === "string" ? br.solution : undefined,
            sourcePage: src ?? null,
          });
        } else if (kind === "table" && Array.isArray(br.headers) && Array.isArray(br.rows)) {
          blocks.push({
            kind: "table",
            headers: br.headers.filter((x): x is string => typeof x === "string"),
            rows: (br.rows as unknown[]).map((r) =>
              Array.isArray(r) ? r.filter((x): x is string => typeof x === "string") : [],
            ),
            sourcePage: src ?? null,
          });
        } else if (kind === "check" && typeof br.question === "string") {
          blocks.push({ kind: "check", question: br.question, hint: String(br.hint || ""), sourcePage: src ?? null });
        }
      }
      if (blocks.length > 0) {
        sections.push({ id: `s${i}_${Date.now().toString(36)}`, type: type as StudyFileSection["type"], title, blocks });
        i++;
      }
    }
    if (sections.length === 0) throw new Error("The AI could not build a study file from these pages.");

    const now = Date.now();
    const title =
      args.titleOverride?.trim() ||
      (typeof parsed.title === "string" && parsed.title.trim()) ||
      (book ? `${book.title} — Study File` : "Study File");
    const studyFileId = await ctx.runMutation(apiInsertStudyFile, {
      doc: {
        userId: user._id,
        title,
        subject: book?.subject ?? "physics",
        grade: book?.grade ?? 9,
        chapterTitle: book ? undefined : undefined,
        unitTitle: undefined,
        scope: args.scope,
        pageIds: JSON.stringify(args.pageIds.map(String)),
        sections: JSON.stringify(sections),
        pageCount: pages.length,
        createdAt: now,
        updatedAt: now,
      },
    });
    return { studyFileId };
  },
});

export const insertStudyFile = mutation({
  args: { doc: v.any() },
  handler: async (ctx, args) => {
    return await ctx.db.insert("studyFiles", args.doc);
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

// ---------------------------------------------------------------------------
// Study This Page panel
// ---------------------------------------------------------------------------

const PAGE_STUDY_PROMPT = `You create a compact "Study This Page" panel from ONE textbook page transcription. Use ONLY the transcription. Mark added general knowledge with "[AI explanation]". Never invent page numbers.
Respond with ONLY JSON:
{
  "whatToKnow": ["..."],
  "terms": [{ "term": "...", "meaning": "..." }],
  "facts": ["..."],
  "diagramInfo": ["..."],
  "quickQuestions": ["..."]
}
Give 3-6 items per list (diagramInfo can be empty). quickQuestions: 5 short questions.`;

export const generatePageStudy = action({
  args: { pageId: v.id("pages") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const page: Doc<"pages"> | null = await ctx.runQuery(api_pagesGet, { pageId: args.pageId });
    if (!page || page.userId !== user._id) throw new Error("Page not found");
    const analysisRows = await ctx.runQuery(apiPageAnalysisRows, { pageId: args.pageId, userId: user._id });
    const text = analysisRows[0]?.fullText || page.extractedText || "";
    if (!text.trim()) throw new Error("Analyse this page first (Highlight Important Things).");
    if (!aiKeyConfigured()) throw new Error("AI is not configured. Add VLY_INTEGRATION_KEY in the Keys/API keys tab.");

    const raw = await callAI(
      [
        { role: "system", content: PAGE_STUDY_PROMPT },
        { role: "user", content: `Page transcription:\n\n${text.slice(0, 6000)}` },
      ],
      { maxTokens: 1500, temperature: 0.2 },
    );
    const parsed = extractJson<{
      whatToKnow?: string[];
      terms?: { term?: string; meaning?: string }[];
      facts?: string[];
      diagramInfo?: string[];
      quickQuestions?: string[];
    }>(raw);
    const panel = {
      whatToKnow: (parsed.whatToKnow ?? []).filter((x): x is string => typeof x === "string").slice(0, 8),
      terms: (parsed.terms ?? [])
        .filter((t) => t && typeof t.term === "string" && typeof t.meaning === "string")
        .slice(0, 8)
        .map((t) => ({ term: t.term as string, meaning: t.meaning as string })),
      facts: (parsed.facts ?? []).filter((x): x is string => typeof x === "string").slice(0, 8),
      diagramInfo: (parsed.diagramInfo ?? []).filter((x): x is string => typeof x === "string").slice(0, 6),
      quickQuestions: (parsed.quickQuestions ?? []).filter((x): x is string => typeof x === "string").slice(0, 5),
    };
    await ctx.runMutation(apiSavePageStudy, { userId: user._id, pageId: args.pageId, panel: JSON.stringify(panel) });
    return panel;
  },
});

export const savePageStudy = mutation({
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

// ---------------------------------------------------------------------------
// Highlights -> summary / flashcards / quiz
// ---------------------------------------------------------------------------

export const summarizeHighlights = action({
  args: {
    pageId: v.id("pages"),
    selected: v.array(v.object({ text: v.string(), note: v.optional(v.string()) })),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!aiKeyConfigured()) throw new Error("AI is not configured. Add VLY_INTEGRATION_KEY in the Keys/API keys tab.");
    if (args.selected.length === 0) throw new Error("Select at least one highlight");
    const analysisRows = await ctx.runQuery(apiPageAnalysisRows, { pageId: args.pageId, userId: user._id });
    const fullText = analysisRows[0]?.fullText || "";
    // Only use text that actually exists on the page
    const snippets = args.selected
      .filter((s) => !fullText || fullText.includes(s.text))
      .map((s) => `- ${s.text}${s.note ? ` (${s.note})` : ""}`)
      .join("\n");
    if (!snippets) throw new Error("Selected highlights are not on this page");

    const raw = await callAI(
      [
        {
          role: "system",
          content:
            "You are a study assistant for UAE Grade 9-11 Physics/Biology. Using ONLY the highlighted textbook snippets provided, write a concise explanation (120-200 words) that connects them. You may add brief clarifying phrases but mark any statement not directly in the snippets with '[AI explanation]'. Do not invent facts, formulas or page numbers. Output plain text only.",
        },
        { role: "user", content: `Highlighted snippets:\n${snippets}` },
      ],
      { maxTokens: 600, temperature: 0.3 },
    );
    return { summary: raw.trim() };
  },
});

export const generateHighlightFlashcards = action({
  args: {
    pageId: v.optional(v.id("pages")),
    highlights: v.array(v.object({ text: v.string(), note: v.optional(v.string()) })),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!aiKeyConfigured()) throw new Error("AI is not configured. Add VLY_INTEGRATION_KEY in the Keys/API keys tab.");
    if (args.highlights.length === 0) throw new Error("No highlights to convert");
    const snippets = args.highlights
      .map((h, i) => `${i + 1}. ${h.text}${h.note ? ` (${h.note})` : ""}`)
      .join("\n");
    const raw = await callAI(
      [
        {
          role: "system",
          content:
            "Convert these highlighted textbook snippets into flashcards for a UAE Grade 9-11 student. Use ONLY the given information — front asks about it, back answers with it (may lightly reword the snippet itself, never add outside facts). Aim for 4-12 cards. Respond with ONLY JSON: {\"cards\":[{\"front\":\"...\",\"back\":\"...\"}]}",
        },
        { role: "user", content: snippets },
      ],
      { maxTokens: 1500, temperature: 0.2 },
    );
    const parsed = extractJson<{ cards?: { front?: string; back?: string }[] }>(raw);
    const cards = (parsed.cards ?? [])
      .filter((c) => c && typeof c.front === "string" && typeof c.back === "string" && c.front && c.back)
      .slice(0, 20)
      .map((c) => ({ front: c.front as string, back: c.back as string }));
    if (cards.length === 0) throw new Error("AI could not create flashcards from these highlights");
    await ctx.runMutation(apiSaveHighlightCards, { pageId: args.pageId, cards });
    return { cards };
  },
});

export const generateHighlightQuiz = action({
  args: {
    pageId: v.optional(v.id("pages")),
    highlights: v.array(v.object({ text: v.string(), note: v.optional(v.string()) })),
    count: v.union(v.literal(5), v.literal(10), v.literal(15), v.literal(20)),
    difficulty: v.union(v.literal("easy"), v.literal("medium"), v.literal("hard"), v.literal("mixed")),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (!aiKeyConfigured()) throw new Error("AI is not configured. Add VLY_INTEGRATION_KEY in the Keys/API keys tab.");
    if (args.highlights.length === 0) throw new Error("No highlights to quiz on");
    const snippets = args.highlights
      .map((h, i) => `${i + 1}. ${h.text}${h.note ? ` (${h.note})` : ""}`)
      .join("\n");
    const raw = await callAI(
      [
        {
          role: "system",
          content: `Create a quiz STRICTLY from these highlighted textbook snippets for a UAE Grade 9-11 student. Exactly ${args.count} questions. Difficulty: ${args.difficulty}. Use multiple-choice (4 options) for most questions; for physics calculations the answer must be mathematically correct. Every question must be answerable from the snippets. Respond with ONLY JSON:
{"questions":[{"questionText":"...","type":"mcq","options":["A","B","C","D"],"correctAnswer":"exact text of the correct option","explanation":"why, referencing the snippet"}]}`,
        },
        { role: "user", content: snippets },
      ],
      { maxTokens: 3500, temperature: 0.3 },
    );
    const parsed = extractJson<{
      questions?: {
        questionText?: string;
        type?: string;
        options?: string[];
        correctAnswer?: string;
        explanation?: string;
      }[];
    }>(raw);
    const questions = (parsed.questions ?? [])
      .filter(
        (q) =>
          q &&
          typeof q.questionText === "string" &&
          typeof q.correctAnswer === "string" &&
          q.questionText &&
          q.correctAnswer,
      )
      .slice(0, args.count)
      .map((q) => ({
        questionText: q.questionText as string,
        type: typeof q.type === "string" ? q.type : "mcq",
        options: Array.isArray(q.options) ? q.options.filter((o): o is string => typeof o === "string") : [],
        correctAnswer: q.correctAnswer as string,
        explanation: typeof q.explanation === "string" ? q.explanation : "",
      }));
    if (questions.length === 0) throw new Error("AI could not generate a quiz from these highlights");
    return { questions };
  },
});
