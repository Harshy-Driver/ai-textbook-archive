"use node";

// AI actions for Smart Highlights & Study Files.
// Node runtime: calls the VLY AI gateway (OpenAI-compatible) with vision input,
// persists results through internal functions in studyAi.ts.

import { action } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";
import { callAI, extractJson, hashString, aiKeyConfigured } from "./aiClient";
import type { Doc, Id } from "./_generated/dataModel";
import type {
  StudyFileSection,
  StudyBlock,
} from "./studyAi";
import type { HighlightKind, HighlightPriority } from "../lib/highlights";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function requireActionUser(ctx: ActionCtx): Promise<Doc<"users">> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Not authenticated");
  const user = await ctx.runQuery(internal.studyAi.getUserDoc, { userId });
  if (!user) throw new Error("User not found");
  return user;
}

async function resolvePage(
  ctx: ActionCtx,
  pageId: Id<"pages">,
  userId: Id<"users">,
): Promise<Doc<"pages">> {
  const page = await ctx.runQuery(internal.studyAi.getPageDoc, { pageId });
  if (!page) throw new Error("Page not found");
  if (page.userId !== userId) throw new Error("Not authorized");
  return page;
}

/** Fetch the page image and build an OpenAI-compatible vision content part. */
async function buildPageParts(imageUrl: string) {
  // Data URLs (how uploaded pages are stored) are decoded directly
  const dataMatch = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(imageUrl);
  if (dataMatch) {
    const mime = dataMatch[1] || "image/jpeg";
    const base64 = dataMatch[2]
      ? dataMatch[3]
      : Buffer.from(decodeURIComponent(dataMatch[3]), "utf8").toString("base64");
    return [
      { type: "text" as const, text: "Read this textbook page." },
      { type: "image_url" as const, image_url: { url: `data:${mime};base64,${base64}` } },
    ];
  }
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Could not fetch page image (${res.status})`);
  const buf = await res.arrayBuffer();
  const base64 = Buffer.from(buf).toString("base64");
  const contentType = res.headers.get("content-type") ?? "image/jpeg";
  return [
    { type: "text" as const, text: "Read this textbook page." },
    {
      type: "image_url" as const,
      image_url: { url: `data:${contentType};base64,${base64}` },
    },
  ];
}

const PRIORITIES: HighlightPriority[] = ["high", "medium", "low"];

const KINDS = [
  "definition", "concept", "law", "formula", "equation", "fact",
  "vocabulary", "process", "step", "cause_effect", "example",
  "exam_relevant", "diagram_label", "comparison", "objective",
] as const;

type RawHighlight = {
  id: string;
  text: string;
  priority: HighlightPriority;
  kind: HighlightKind;
  note?: string;
  source: "ai" | "user";
};

function makeHighlightId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `hl-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
}

function normalizeHighlights(raw: unknown, max: number): RawHighlight[] {
  if (!Array.isArray(raw)) return [];
  const out: RawHighlight[] = [];
  for (const item of raw.slice(0, max)) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const text = typeof o.text === "string" ? o.text.trim() : "";
    if (!text) continue;
    const priority = PRIORITIES.includes(o.priority as HighlightPriority)
      ? (o.priority as HighlightPriority)
      : "medium";
    const kind = KINDS.includes(o.kind as (typeof KINDS)[number])
      ? (o.kind as HighlightKind)
      : "concept";
    out.push({
      id: makeHighlightId(),
      text: text.slice(0, 400),
      priority,
      kind,
      note: typeof o.note === "string" && o.note.trim() ? o.note.trim().slice(0, 300) : undefined,
      source: "ai",
    });
  }
  return out;
}

const INTENSITY_GUIDE: Record<string, string> = {
  light:
    "LIGHT intensity: mark ONLY the 4-8 most essential items (core definitions, laws/formulas, main concepts). Leave supporting detail unhighlighted.",
  balanced:
    "BALANCED intensity: mark the important concepts, definitions, laws/formulas, key facts and useful supporting information (typically 8-18 items).",
  exam_focus:
    "EXAM FOCUS intensity: prioritise information most likely to require detailed understanding - definitions, laws, formulas, calculations, processes, labelled diagram details, comparisons and application examples (typically 12-22 items). Do NOT claim anything is guaranteed on the exam.",
};

const PAGE_ANALYSIS_SYSTEM = `You are a precise OCR + study assistant for UAE Grade 9-11 Physics and Biology textbooks (English).
You are given a photo of one textbook page. Return ONLY JSON (no markdown fences) shaped exactly:
{
  "readability": "clear" | "partially_readable" | "unreadable",
  "readabilityNote": string (empty if clear),
  "pageNumber": number | null (ONLY if a printed page number is visible; otherwise null),
  "fullText": string (transcribe ALL readable text EXACTLY, preserving wording, numbers, formulas and order; use line breaks between lines. Never invent or fix text),
  "structure": { "unitTitle": string|null, "chapterTitle": string|null, "lessonTitle": string|null },
  "highlights": [ { "text": string (an EXACT verbatim snippet copied from fullText), "priority": "high"|"medium"|"low", "kind": "definition"|"concept"|"law"|"formula"|"equation"|"fact"|"vocabulary"|"process"|"step"|"cause_effect"|"example"|"exam_relevant"|"diagram_label"|"comparison"|"objective", "note": string (optional short why-it-matters note) } ]
}
CRITICAL RULES:
- Every highlight text MUST be a word-for-word substring of fullText. Never paraphrase, never merge separate lines into one snippet unless they are truly contiguous in fullText.
- Highlight only genuinely important information (definitions, key concepts, laws, formulas, equations, important facts, key vocabulary, processes, steps, cause-and-effect, important examples, exam-relevant info, diagram labels, comparisons, learning objectives). Never highlight whole paragraphs.
- If the photo is blurry or unreadable, set readability accordingly and transcribe only what is reliably readable. Do NOT guess.`;

const STUDY_PANEL_SYSTEM = `You are a study assistant for UAE Grade 9-11 Physics and Biology.
Using ONLY the page transcription provided (the student's actual textbook), return ONLY JSON:
{
  "whatToKnow": string[] (3-7 checklist items starting with verbs like Understand/Explain/Identify/Calculate/Compare/Describe),
  "terms": [ { "term": string, "meaning": string } ] (important vocabulary actually on the page),
  "facts": string[] (important facts from the page),
  "diagramInfo": string[] (what any diagrams/tables on the page show and their key labels; empty if none),
  "quickQuestions": string[] (exactly 5 short questions answerable from this page)
}
Never invent content that is not supported by the transcription.`;

const STUDY_FILE_SYSTEM = `You are an expert study-guide writer for UAE Grade 9-11 Physics and Biology (English).
You will receive one or more textbook page transcriptions (with source labels) and their highlights.
Produce a structured revision document as ONLY JSON:
{
  "title": string (the lesson or chapter title from the textbook; fall back to a clear descriptive title),
  "sections": [ { "id": string (short-unique), "type": string, "title": string, "blocks": [block] } ]
}
Block kinds (use exactly these shapes):
- {"kind":"paragraph","text":string,"sourcePage":string|null}
- {"kind":"bullets","items":string[],"sourcePage":string|null}
- {"kind":"numbered","items":string[],"sourcePage":string|null}
- {"kind":"definition","term":string,"meaning":string,"sourcePage":string|null}
- {"kind":"formula","formula":string,"symbols":string,"units":string,"whenToUse":string,"example":string(optional),"solution":string(optional),"sourcePage":string|null}
- {"kind":"table","headers":string[],"rows":string[][],"sourcePage":string|null}
- {"kind":"check","question":string,"hint":string}
GUIDELINES:
- Include sections for: what the lesson is about; must-know concepts; key definitions; important facts; formulas (Physics, using the formula block for every formula); processes step-by-step (Biology); diagrams/tables; examples; common mistakes; quick review; check-yourself (use the "check" block for 5 questions).
- sourcePage must be the exact source label given to you (e.g. "Page 12") or null. NEVER invent page numbers.
- Base everything on the transcriptions. You may add short, clearly-worded explanations to help a Grade 9-11 student, but textbook wording, numbers and formulas must be preserved exactly.
- Keep it concise enough for quick revision.`;

const SUMMARY_SYSTEM = `You are a study assistant for UAE Grade 9-11 Physics and Biology.
Explain the following selected textbook highlights to the student. Use ONLY these highlights (and grade-appropriate wording). Do not add outside topics. Keep it under 180 words, plain prose.`;

const FLASHCARDS_SYSTEM = `You are a flashcard writer for UAE Grade 9-11 Physics and Biology.
From the provided textbook highlights ONLY, create front/back flashcards. Return ONLY JSON:
{ "cards": [ { "front": string (a question or term), "back": string (a short answer) } ] }
Maximum 16 cards. Only use information present in the highlights.`;

const QUIZ_SYSTEM = `You are a quiz writer for UAE Grade 9-11 Physics and Biology.
From the provided textbook highlights ONLY, write a multiple-choice quiz. Return ONLY JSON:
{ "questions": [ { "questionText": string, "type": "mcq", "options": [string, string, string, string], "correctAnswer": string (must exactly match one option), "explanation": string } ] }
Rules: 4 options each, exactly one correct, plausible distractors, grade-appropriate wording.`;

// ---------------------------------------------------------------------------
// analyzePage — vision OCR + highlight detection (cached by image hash)
// ---------------------------------------------------------------------------

export const analyzePage = action({
  args: {
    pageId: v.id("pages"),
    imageUrl: v.optional(v.string()),
    intensity: v.optional(
      v.union(v.literal("light"), v.literal("balanced"), v.literal("exam_focus")),
    ),
    force: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireActionUser(ctx);
    if (!aiKeyConfigured()) {
      throw new Error(
        "AI is not configured: add OPENROUTER_API_KEY in the project's Keys/API keys tab.",
      );
    }
    const page = await resolvePage(ctx, args.pageId, user._id);
    const imageUrl = args.imageUrl ?? page.imageUrl;

    // Mark processing so the UI shows state
    await ctx.runMutation(internal.studyAi.touchPage, {
      pageId: args.pageId,
      status: "processing",
    });

    try {
      const parts = await buildPageParts(imageUrl);
      const intensity = args.intensity ?? "balanced";
      const raw = await callAI(
        [
          { role: "system", content: PAGE_ANALYSIS_SYSTEM },
          {
            role: "user",
            content: [
              {
                type: "text" as const,
                text: `Study intensity: ${INTENSITY_GUIDE[intensity] ?? INTENSITY_GUIDE.balanced}`,
              },
              ...parts,
            ],
          },
        ],
        { maxTokens: 3000, temperature: 0 },
      );

      const parsed = extractJson<{
        readability?: string;
        readabilityNote?: string;
        pageNumber?: number | null;
        fullText?: string;
        structure?: {
          unitTitle?: string | null;
          chapterTitle?: string | null;
          lessonTitle?: string | null;
        };
        highlights?: unknown;
      }>(raw);

      const fullText = (parsed.fullText ?? "").trim();
      const readability =
        parsed.readability === "clear" ||
        parsed.readability === "partially_readable" ||
        parsed.readability === "unreadable"
          ? parsed.readability
          : "partially_readable";
      const highlights = normalizeHighlights(parsed.highlights, 24);
      const textHash = hashString(fullText || imageUrl);
      const pageNumber =
        typeof parsed.pageNumber === "number" &&
        Number.isFinite(parsed.pageNumber) &&
        parsed.pageNumber > 0 &&
        parsed.pageNumber < 1000
          ? Math.round(parsed.pageNumber)
          : undefined;

      const ocrConfidence =
        readability === "clear" ? 0.95 : readability === "partially_readable" ? 0.65 : 0.15;

      // Cache: reuse existing row for this user+page, else create
      const existing = await ctx.runQuery(internal.studyAi.getPageAnalysisRows, {
        pageId: args.pageId,
        userId: user._id,
      });

      const analysisDoc = {
        textHash,
        fullText,
        pageNumber,
        ocrConfidence,
        readability: readability as "clear" | "partially_readable" | "unreadable",
        readabilityNote: parsed.readabilityNote?.slice(0, 300) ?? undefined,
        highlights: JSON.stringify(highlights),
        updatedAt: Date.now(),
      };

      if (existing.length > 0) {
        await ctx.runMutation(internal.studyAi.patchAnalysis, {
          id: existing[0]._id,
          doc: analysisDoc,
        });
      } else {
        await ctx.runMutation(internal.studyAi.insertAnalysis, {
          doc: { userId: user._id, pageId: args.pageId, ...analysisDoc },
        });
      }

      // Keep page status in sync, then store detected structure
      await ctx.runMutation(internal.studyAi.touchPage, {
        pageId: args.pageId,
        status: readability === "unreadable" ? "unreadable" : "processed",
        extractedText: fullText,
        ocrConfidence,
      });

      const struct = parsed.structure ?? {};
      if (readability !== "unreadable" && (struct.unitTitle || struct.chapterTitle || struct.lessonTitle)) {
        await ctx.runMutation(internal.studyAi.patchPageStructure, {
          pageId: args.pageId,
          unitTitle: struct.unitTitle ?? undefined,
          chapterTitle: struct.chapterTitle ?? undefined,
          lessonTitle: struct.lessonTitle ?? undefined,
        });
      }

      return {
        highlights,
        readability,
        readabilityNote: analysisDoc.readabilityNote ?? null,
        fullText,
        pageNumber: pageNumber ?? null,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Analysis failed";
      await ctx.runMutation(internal.studyAi.touchPage, {
        pageId: args.pageId,
        status: "failed",
      });
      throw new Error(message);
    }
  },
});

// ---------------------------------------------------------------------------
// generatePageStudy — "Study This Page" panel
// ---------------------------------------------------------------------------

export const generatePageStudy = action({
  args: { pageId: v.id("pages") },
  handler: async (ctx, args) => {
    const user = await requireActionUser(ctx);
    await resolvePage(ctx, args.pageId, user._id);

    const rows = await ctx.runQuery(internal.studyAi.getPageAnalysisRows, {
      pageId: args.pageId,
      userId: user._id,
    });
    const fullText = rows[0]?.fullText ?? "";
    if (!fullText) {
      throw new Error("Run 'Highlight Important Things' first so the page can be read.");
    }

    const raw = await callAI(
      [
        { role: "system", content: STUDY_PANEL_SYSTEM },
        {
          role: "user",
          content: `Textbook page transcription:\n\n${fullText.slice(0, 8000)}`,
        },
      ],
      { maxTokens: 1500, temperature: 0.2 },
    );

    const parsed = extractJson<{
      whatToKnow?: unknown;
      terms?: unknown;
      facts?: unknown;
      diagramInfo?: unknown;
      quickQuestions?: unknown;
    }>(raw);

    const strArr = (v: unknown, max: number) =>
      Array.isArray(v)
        ? v.filter((x): x is string => typeof x === "string" && !!x.trim()).slice(0, max)
        : [];
    const terms = Array.isArray(parsed.terms)
      ? parsed.terms
          .filter(
            (t): t is { term: string; meaning: string } =>
              !!t &&
              typeof t === "object" &&
              typeof (t as { term?: unknown }).term === "string" &&
              typeof (t as { meaning?: unknown }).meaning === "string",
          )
          .slice(0, 10)
      : [];

    const panel = {
      whatToKnow: strArr(parsed.whatToKnow, 8),
      terms,
      facts: strArr(parsed.facts, 10),
      diagramInfo: strArr(parsed.diagramInfo, 8),
      quickQuestions: strArr(parsed.quickQuestions, 5),
    };

    await ctx.runMutation(internal.studyAi.savePageStudyInternal, {
      userId: user._id,
      pageId: args.pageId,
      panel: JSON.stringify(panel),
    });

    return panel;
  },
});

// ---------------------------------------------------------------------------
// summarizeHighlights — explanation built only from selected highlights
// ---------------------------------------------------------------------------

export const summarizeHighlights = action({
  args: {
    pageId: v.id("pages"),
    selected: v.array(v.object({ text: v.string(), note: v.optional(v.string()) })),
  },
  handler: async (ctx, args) => {
    const user = await requireActionUser(ctx);
    await resolvePage(ctx, args.pageId, user._id);

    const list = args.selected
      .map((s) => `- ${s.text}${s.note ? ` (note: ${s.note})` : ""}`)
      .join("\n");
    if (!list) throw new Error("No highlights selected");

    const summary = await callAI(
      [
        { role: "system", content: SUMMARY_SYSTEM },
        { role: "user", content: `Selected highlights from the textbook page:\n${list}` },
      ],
      { maxTokens: 600, temperature: 0.3 },
    );
    return { summary: summary.trim() };
  },
});

// ---------------------------------------------------------------------------
// generateHighlightFlashcards
// ---------------------------------------------------------------------------

export const generateHighlightFlashcards = action({
  args: {
    pageId: v.optional(v.id("pages")),
    highlights: v.array(v.object({ text: v.string(), note: v.optional(v.string()) })),
  },
  handler: async (ctx, args) => {
    const user = await requireActionUser(ctx);
    if (args.pageId) await resolvePage(ctx, args.pageId, user._id);

    const list = args.highlights
      .map((h) => `- ${h.text}${h.note ? ` (note: ${h.note})` : ""}`)
      .join("\n");
    if (!list) throw new Error("No highlights to work with");

    const raw = await callAI(
      [
        { role: "system", content: FLASHCARDS_SYSTEM },
        { role: "user", content: `Textbook highlights:\n${list.slice(0, 6000)}` },
      ],
      { maxTokens: 1800, temperature: 0.2 },
    );

    const parsed = extractJson<{ cards?: unknown }>(raw);
    const cards = Array.isArray(parsed.cards)
      ? parsed.cards
          .filter(
            (c): c is { front: string; back: string } =>
              !!c &&
              typeof c === "object" &&
              typeof (c as { front?: unknown }).front === "string" &&
              typeof (c as { back?: unknown }).back === "string",
          )
          .map((c) => ({ front: c.front.slice(0, 300), back: c.back.slice(0, 500) }))
          .slice(0, 16)
      : [];
    if (cards.length === 0) throw new Error("The AI could not create flashcards from these highlights");
    return { cards };
  },
});

// ---------------------------------------------------------------------------
// generateHighlightQuiz
// ---------------------------------------------------------------------------

export const generateHighlightQuiz = action({
  args: {
    pageId: v.optional(v.id("pages")),
    highlights: v.array(v.object({ text: v.string(), note: v.optional(v.string()) })),
    count: v.union(v.literal(5), v.literal(10), v.literal(15), v.literal(20)),
    difficulty: v.union(
      v.literal("easy"), v.literal("medium"), v.literal("hard"), v.literal("mixed"),
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireActionUser(ctx);
    if (args.pageId) await resolvePage(ctx, args.pageId, user._id);

    const list = args.highlights
      .map((h) => `- ${h.text}${h.note ? ` (note: ${h.note})` : ""}`)
      .join("\n");
    if (!list) throw new Error("No highlights to work with");

    const raw = await callAI(
      [
        { role: "system", content: QUIZ_SYSTEM },
        {
          role: "user",
          content: `Difficulty: ${args.difficulty}. Write exactly ${args.count} questions.\n\nTextbook highlights:\n${list.slice(0, 8000)}`,
        },
      ],
      { maxTokens: 2500, temperature: 0.3 },
    );

    const parsed = extractJson<{ questions?: unknown }>(raw);
    const questions = Array.isArray(parsed.questions)
      ? parsed.questions
          .map((q) => q as Record<string, unknown>)
          .filter(
            (q): q is {
              questionText: string;
              type: string;
              options: string[];
              correctAnswer: string;
              explanation: string;
            } =>
              typeof q.questionText === "string" &&
              Array.isArray(q.options) &&
              q.options.every((o) => typeof o === "string") &&
              typeof q.correctAnswer === "string" &&
              q.options.includes(q.correctAnswer),
          )
          .map((q) => ({
            questionText: q.questionText,
            type: "mcq",
            options: q.options.slice(0, 5),
            correctAnswer: q.correctAnswer,
            explanation: typeof q.explanation === "string" ? q.explanation : "",
          }))
          .slice(0, args.count)
      : [];
    if (questions.length === 0) throw new Error("The AI could not create a quiz from these highlights");
    return { questions };
  },
});

// ---------------------------------------------------------------------------
// generateStudyFile — lesson/pages/chapter revision document
// ---------------------------------------------------------------------------

export const generateStudyFile = action({
  args: {
    pageIds: v.array(v.id("pages")),
    scope: v.union(
      v.literal("lesson"), v.literal("page"), v.literal("pages"), v.literal("chapter"),
    ),
  },
  handler: async (ctx, args): Promise<{ studyFileId: string; title: string }> => {
    const user = await requireActionUser(ctx);
    if (args.pageIds.length === 0) throw new Error("Select at least one page");

    // Load pages + analyses in reading order
    const pagesWithAnalysis: Array<{
      page: Doc<"pages">;
      analysis: Doc<"pageAnalysis"> | null;
    }> = [];
    for (const pageId of args.pageIds.slice(0, 12)) {
      const page = await resolvePage(ctx, pageId, user._id);
      const rows = await ctx.runQuery(internal.studyAi.getPageAnalysisRows, {
        pageId,
        userId: user._id,
      });
      pagesWithAnalysis.push({ page, analysis: rows[0] ?? null });
    }

    const analysed = pagesWithAnalysis.filter((p) => p.analysis?.fullText);
    if (analysed.length === 0) {
      throw new Error(
        "No analysed pages selected. Run 'Highlight Important Things' on the pages first.",
      );
    }

    const sourceBlocks = analysed
      .map(({ analysis }, idx) => {
        const printed = analysis?.pageNumber ? `Page ${analysis.pageNumber}` : null;
        const label = printed ?? `Page ${idx + 1}`;
        const hl = analysis?.highlights
          ? (JSON.parse(analysis.highlights) as Array<{ text: string; priority: string }>)
          : [];
        const hlText = hl
          .map((h) => `  - (${h.priority}) ${h.text}`)
          .join("\n");
        return `SOURCE ${label}:\n${analysis?.fullText ?? ""}\nHighlighted as important:\n${hlText}`;
      })
      .join("\n\n---\n\n");

    const raw = await callAI(
      [
        { role: "system", content: STUDY_FILE_SYSTEM },
        {
          role: "user",
          content: `Subject: ${user.subject ?? "physics"} · Grade: ${user.grade ?? 10} · Scope: ${args.scope}\n\n${sourceBlocks.slice(0, 48000)}`,
        },
      ],
      { maxTokens: 8000, temperature: 0.3 },
    );

    const parsed = extractJson<{
      title?: unknown;
      sections?: unknown;
    }>(raw);

    const title =
      typeof parsed.title === "string" && parsed.title.trim()
        ? parsed.title.trim().slice(0, 120)
        : analysed[0]?.page.lessonTitle || "Study File";

    const sections = normalizeStudySections(parsed.sections);

    // Derive book meta from the first page
    const firstPage = analysed[0].page;
    let book: Doc<"books"> | null = null;
    try {
      book = await ctx.runQuery(internal.studyAi.getBookDoc, { bookId: firstPage.bookId });
    } catch {
      book = null;
    }

    const now = Date.now();
    const studyFileId = await ctx.runMutation(internal.studyAi.insertStudyFile, {
      doc: {
        userId: user._id,
        title,
        subject: book?.subject ?? user.subject ?? "physics",
        grade: book?.grade ?? user.grade ?? 10,
        chapterTitle: firstPage.chapterTitle ?? undefined,
        unitTitle: firstPage.unitTitle ?? undefined,
        scope: args.scope,
        pageIds: JSON.stringify(analysed.map((p) => String(p.page._id))),
        sections: JSON.stringify(sections),
        pageCount: analysed.length,
        createdAt: now,
        updatedAt: now,
      },
    });

    return { studyFileId: String(studyFileId), title };
  },
});

function normalizeStudySections(raw: unknown): StudyFileSection[] {
  if (!Array.isArray(raw)) return [];
  const out: StudyFileSection[] = [];
  raw.slice(0, 16).forEach((s, si) => {
    if (!s || typeof s !== "object") return;
    const o = s as Record<string, unknown>;
    const title = typeof o.title === "string" ? o.title : `Section ${si + 1}`;
    const blocksRaw = Array.isArray(o.blocks) ? o.blocks : [];
    const blocks: StudyBlock[] = [];
    for (const b of blocksRaw) {
      if (!b || typeof b !== "object") continue;
      const bl = b as Record<string, unknown>;
      const src =
        typeof bl.sourcePage === "string" && bl.sourcePage.trim()
          ? bl.sourcePage.trim()
          : undefined;
      const str = (v: unknown, fallback = "") =>
        typeof v === "string" ? v : fallback;
      switch (bl.kind) {
        case "paragraph":
          if (str(bl.text)) blocks.push({ kind: "paragraph", text: str(bl.text), sourcePage: src });
          break;
        case "bullets":
        case "numbered": {
          const items = Array.isArray(bl.items)
            ? bl.items.filter((i): i is string => typeof i === "string").slice(0, 12)
            : [];
          if (items.length)
            blocks.push(bl.kind === "bullets" ? { kind: "bullets", items, sourcePage: src } : { kind: "numbered", items, sourcePage: src });
          break;
        }
        case "definition":
          if (str(bl.term) && str(bl.meaning))
            blocks.push({ kind: "definition", term: str(bl.term), meaning: str(bl.meaning), sourcePage: src });
          break;
        case "formula":
          if (str(bl.formula))
            blocks.push({
              kind: "formula",
              formula: str(bl.formula),
              symbols: str(bl.symbols, "—"),
              units: str(bl.units, "—"),
              whenToUse: str(bl.whenToUse, "—"),
              example: str(bl.example) || undefined,
              solution: str(bl.solution) || undefined,
              sourcePage: src,
            });
          break;
        case "table": {
          const headers = Array.isArray(bl.headers)
            ? bl.headers.filter((h): h is string => typeof h === "string").slice(0, 6)
            : [];
          const rows = Array.isArray(bl.rows)
            ? bl.rows
                .filter((r): r is string[] => Array.isArray(r))
                .map((r) => r.map((c) => (typeof c === "string" ? c : String(c ?? ""))))
                .slice(0, 12)
            : [];
          if (headers.length && rows.length)
            blocks.push({ kind: "table", headers, rows, sourcePage: src });
          break;
        }
        case "check":
          if (str(bl.question))
            blocks.push({ kind: "check", question: str(bl.question), hint: str(bl.hint, "—") });
          break;
      }
    }
    if (blocks.length) {
      out.push({
        id: typeof o.id === "string" && o.id.trim() ? o.id.trim().slice(0, 40) : `sec-${si}`,
        type: typeof o.type === "string" ? o.type : "content",
        title: title.slice(0, 120),
        blocks,
      });
    }
  });
  return out;
}

// ---------------------------------------------------------------------------
// recomputeLessonAnalysis — regenerate lesson summaries/checklists/formulas
// from real page transcriptions (called after pages are analysed)
// ---------------------------------------------------------------------------

const LESSON_SYSTEM = `You are a curriculum assistant for UAE Grade 9-11 Physics and Biology (English).
Given textbook page transcriptions that belong to one lesson, return ONLY JSON:
{
  "summary": string (2-3 sentences describing the lesson, based only on the pages),
  "keyTerms": string[] (up to 10 key vocabulary terms on the pages),
  "formulas": string[] (formulas exactly as printed, e.g. "F = m × a"; empty for Biology unless present),
  "objectives": string[] (up to 8 "You need to know" checklist items starting with verbs),
  "mustKnow": string[] (the most important points),
  "important": string[] (useful supporting points),
  "extra": string[] (lower-priority details)
}
Only include information supported by the transcriptions.`;

export const recomputeLessonAnalysis = action({
  args: { lessonId: v.id("lessons") },
  handler: async (ctx, args) => {
    const user = await requireActionUser(ctx);
    const lesson = await ctx.runQuery(internal.studyAi.getLessonDoc, { lessonId: args.lessonId });
    if (!lesson || lesson.userId !== user._id) throw new Error("Lesson not found");

    const pageRows = await ctx.runQuery(internal.studyAi.listLessonPages, {
      lessonId: args.lessonId,
    });

    const texts: string[] = [];
    for (const lp of pageRows) {
      const rows = await ctx.runQuery(internal.studyAi.getPageAnalysisRows, {
        pageId: lp.pageId,
        userId: user._id,
      });
      if (rows[0]?.fullText) texts.push(rows[0].fullText);
    }
    if (texts.length === 0) {
      throw new Error("No analysed pages belong to this lesson yet.");
    }

    const raw = await callAI(
      [
        { role: "system", content: LESSON_SYSTEM },
        {
          role: "user",
          content: `Lesson: ${lesson.title}\n\nPage transcriptions:\n${texts.join("\n\n---\n\n").slice(0, 50000)}`,
        },
      ],
      { maxTokens: 2200, temperature: 0.3 },
    );

    const parsed = extractJson<{
      summary?: unknown; keyTerms?: unknown; formulas?: unknown; objectives?: unknown;
      mustKnow?: unknown; important?: unknown; extra?: unknown;
    }>(raw);
    const strArr = (v: unknown, max: number) =>
      Array.isArray(v)
        ? v.filter((x): x is string => typeof x === "string" && !!x.trim()).slice(0, max)
        : [];

    await ctx.runMutation(internal.studyAi.updateLessonFields, {
      lessonId: args.lessonId,
      summary: typeof parsed.summary === "string" ? parsed.summary.slice(0, 800) : undefined,
      keyTerms: JSON.stringify(strArr(parsed.keyTerms, 10)),
      formulas: JSON.stringify(strArr(parsed.formulas, 12)),
      objectives: JSON.stringify(strArr(parsed.objectives, 8)),
    });

    // Replace the lesson info tiers
    const tiers: Array<{ level: "must_know" | "important" | "extra"; items: unknown }> = [
      { level: "must_know", items: parsed.mustKnow },
      { level: "important", items: parsed.important },
      { level: "extra", items: parsed.extra },
    ];
    await ctx.runMutation(internal.studyAi.clearLessonInfo, { lessonId: args.lessonId });
    let order = 0;
    for (const tier of tiers) {
      for (const text of strArr(tier.items, 12)) {
        await ctx.runMutation(internal.studyAi.insertLessonInfo, {
          userId: user._id,
          lessonId: args.lessonId,
          level: tier.level,
          content: text,
          order: order++,
        });
      }
    }
    return { success: true };
  },
});
