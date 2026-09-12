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

const STUDY_FILE_ENRICH_SYSTEM = `You are an expert study-guide writer for UAE Grade 9-11 Physics and Biology (English).
You receive one or more textbook page transcriptions (labelled by source). Write the narrative parts of a revision document.
Return ONLY JSON:
{
  "title": string (the lesson or chapter title from the textbook; else a clear descriptive title),
  "overview": string (2-3 sentences describing what this material is about),
  "commonMistakes": string[] (3-6 mistakes students commonly make on this topic, based on the pages),
  "checks": [ { "question": string, "hint": string } ] (exactly 5 short check-yourself questions with a short answer hint)
}
Base everything on the transcriptions. Preserve textbook wording, numbers and formulas exactly. Never invent page numbers or content.`;

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
        "AI is not configured: add OPENROUTER_API_KEY or MISTRAL_API_KEY in the project's Keys/API keys tab.",
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
// generateStudyFile — revision document assembled deterministically from the
// analysed pages (with an optional small AI enrichment). Assembly never depends
// on one large AI response, so it cannot fail on output limits.
// ---------------------------------------------------------------------------

function dedupeItems<T extends { text: string }>(items: T[], max: number): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const it of items) {
    const key = it.text.toLowerCase().replace(/\s+/g, " ").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(it);
    if (out.length >= max) break;
  }
  return out;
}

/** Render a list of source-tagged bullets as one bullets block per source page. */
function groupBySource(items: Array<{ text: string; label: string }>): StudyBlock[] {
  const map = new Map<string, string[]>();
  for (const it of items) {
    if (!map.has(it.label)) map.set(it.label, []);
    map.get(it.label)!.push(it.text);
  }
  return Array.from(map.entries()).map(([label, texts]) => ({
    kind: "bullets" as const,
    items: texts,
    sourcePage: label,
  }));
}

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

    // Load pages + analyses + per-page study panels in reading order
    const loaded: Array<{
      page: Doc<"pages">;
      analysis: Doc<"pageAnalysis"> | null;
      panel: PagePanel | null;
    }> = [];
    for (const pageId of args.pageIds.slice(0, 12)) {
      const page = await resolvePage(ctx, pageId, user._id);
      const rows = await ctx.runQuery(internal.studyAi.getPageAnalysisRows, {
        pageId,
        userId: user._id,
      });
      const panelRaw = await ctx.runQuery(internal.studyAi.getPageStudyPanel, {
        pageId,
        userId: user._id,
      });
      loaded.push({ page, analysis: rows[0] ?? null, panel: parsePanel(panelRaw) });
    }

    const analysed = loaded.filter((p) => p.analysis?.fullText);
    if (analysed.length === 0) {
      throw new Error(
        "No analysed pages selected. Run 'Highlight Important Things' on the pages first.",
      );
    }

    // Printed page numbers are used ONLY when they were actually visible.
    const labels = analysed.map((p, i) =>
      p.analysis?.pageNumber ? `Page ${p.analysis.pageNumber}` : `Page ${i + 1}`,
    );

    const definitions: Array<{ term: string; meaning: string; label: string }> = [];
    const facts: Array<{ text: string; label: string }> = [];
    const examFocus: Array<{ text: string; label: string }> = [];
    const mustKnow: Array<{ text: string; label: string }> = [];
    const formulas: Array<{ text: string; label: string }> = [];
    const quickReview: Array<{ text: string; label: string }> = [];
    const summaries: string[] = [];

    analysed.forEach((p, i) => {
      const label = labels[i];
      const panel = p.panel;
      if (panel?.pageSummary) summaries.push(panel.pageSummary);
      for (const t of panel?.terms ?? []) {
        if (t.term && t.meaning) definitions.push({ term: t.term, meaning: t.meaning, label });
      }
      for (const k of panel?.whatToKnow ?? []) quickReview.push({ text: k, label });
      for (const e of panel?.examFocus ?? []) examFocus.push({ text: e, label });
      for (const f of panel?.formulas ?? []) formulas.push({ text: f, label });

      for (const h of safeHighlights(p.analysis?.highlights)) {
        if (h.kind === "definition" || h.kind === "vocabulary") {
          const shortTerm = (h.note?.trim() || h.text.split(/[.:\u2013\u2014-]/)[0] || "Definition").slice(0, 80);
          definitions.push({ term: shortTerm, meaning: h.text, label });
        } else if (h.kind === "formula" || h.kind === "equation") {
          formulas.push({ text: h.text, label });
        } else if (h.kind === "exam_relevant") {
          examFocus.push({ text: h.text, label });
        } else if (h.priority === "high") {
          mustKnow.push({ text: h.text, label });
        } else if (h.priority === "medium") {
          facts.push({ text: h.text, label });
        }
      }
    });

    // ---- Optional small AI enrichment (title, overview, mistakes, checks) ----
    let aiTitle = "";
    let aiOverview = "";
    let aiMistakes: string[] = [];
    let aiChecks: Array<{ question: string; hint: string }> = [];
    try {
      const aiInput = analysed
        .map((p, i) => `SOURCE ${labels[i]}:\n${(p.analysis?.fullText ?? "").slice(0, 4000)}`)
        .join("\n\n---\n\n")
        .slice(0, 26000);
      const raw = await callAI(
        [
          { role: "system", content: STUDY_FILE_ENRICH_SYSTEM },
          {
            role: "user",
            content: `Subject: ${user.subject ?? "physics"} · Grade: ${user.grade ?? 10} · Scope: ${args.scope}\n\n${aiInput}`,
          },
        ],
        { maxTokens: 1600, temperature: 0.3 },
      );
      const parsed = extractJson<{
        title?: unknown;
        overview?: unknown;
        commonMistakes?: unknown;
        checks?: unknown;
      }>(raw);
      aiTitle = typeof parsed.title === "string" ? parsed.title.trim().slice(0, 120) : "";
      aiOverview = typeof parsed.overview === "string" ? parsed.overview.trim().slice(0, 900) : "";
      aiMistakes = Array.isArray(parsed.commonMistakes)
        ? parsed.commonMistakes
            .filter((m): m is string => typeof m === "string" && !!m.trim())
            .slice(0, 6)
        : [];
      aiChecks = Array.isArray(parsed.checks)
        ? parsed.checks
            .filter(
              (c): c is { question: string; hint: string } =>
                !!c &&
                typeof c === "object" &&
                typeof (c as { question?: unknown }).question === "string",
            )
            .map((c) => ({
              question: c.question.slice(0, 300),
              hint: typeof c.hint === "string" ? c.hint.slice(0, 300) : "—",
            }))
            .slice(0, 5)
        : [];
    } catch {
      // The deterministic document below is complete on its own.
    }

    // ---- Assemble sections (deterministic) ----
    const sections: StudyFileSection[] = [];
    const push = (id: string, title: string, blocks: StudyBlock[]) => {
      if (blocks.length > 0) sections.push({ id, type: "content", title, blocks });
    };

    const overviewText = aiOverview || summaries.join(" ").trim();
    if (overviewText) {
      push("overview", "What This Lesson Is About", [{ kind: "paragraph", text: overviewText }]);
    }

    push("must-know", "Must Know", groupBySource(dedupeItems(mustKnow, 16)));

    const defs: Array<{ term: string; meaning: string; label: string }> = [];
    {
      const seen = new Set<string>();
      for (const d of definitions) {
        const key = `${d.term.toLowerCase()}|${d.meaning.toLowerCase()}`;
        if (!d.term.trim() || seen.has(key)) continue;
        seen.add(key);
        defs.push(d);
        if (defs.length >= 20) break;
      }
    }
    push(
      "definitions",
      "Key Definitions & Word Meanings",
      defs.map((d) => ({
        kind: "definition" as const,
        term: d.term,
        meaning: d.meaning,
        sourcePage: d.label,
      })),
    );

    push("facts", "Important Facts", groupBySource(dedupeItems(facts, 16)));
    push("formulas", "Important Formulas", groupBySource(dedupeItems(formulas, 12)));
    push(
      "exam-focus",
      "Exam Focus — What You Need For The Exam",
      groupBySource(dedupeItems(examFocus, 16)),
    );

    // Per-page coverage: make sure every uploaded page's important parts appear
    analysed.forEach((p, i) => {
      const label = labels[i];
      const panel = p.panel;
      const blocks: StudyBlock[] = [];
      if (panel?.pageSummary) {
        blocks.push({ kind: "paragraph", text: panel.pageSummary, sourcePage: label });
      }
      const kp = dedupeItems(
        (panel?.whatToKnow ?? []).map((t) => ({ text: t, label })),
        8,
      );
      if (kp.length) blocks.push({ kind: "bullets", items: kp.map((k) => k.text), sourcePage: label });
      for (const t of (panel?.terms ?? []).filter((t) => t.term && t.meaning).slice(0, 8)) {
        blocks.push({ kind: "definition", term: t.term, meaning: t.meaning, sourcePage: label });
      }
      const ef = dedupeItems((panel?.examFocus ?? []).map((t) => ({ text: t, label })), 6);
      if (ef.length) blocks.push({ kind: "bullets", items: ef.map((e) => e.text), sourcePage: label });
      if (blocks.length) {
        sections.push({
          id: `page-${i + 1}`,
          type: "page",
          title: `${label} — Important Points`,
          blocks,
        });
      }
    });

    if (aiMistakes.length > 0) {
      push("mistakes", "Common Mistakes", [{ kind: "bullets", items: aiMistakes }]);
    }

    push("quick-review", "Quick Review", groupBySource(dedupeItems(quickReview, 14)));

    const checks: StudyBlock[] =
      aiChecks.length > 0
        ? aiChecks.map((c) => ({ kind: "check" as const, question: c.question, hint: c.hint }))
        : defs.slice(0, 5).map((d) => ({
            kind: "check" as const,
            question: `What is the meaning of “${d.term}”?`,
            hint: d.meaning,
          }));
    push("check-yourself", "Check Yourself", checks);

    // ---- Persist ----
    const title =
      aiTitle ||
      analysed[0]?.page.lessonTitle ||
      analysed[0]?.page.chapterTitle ||
      "Study File";

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

const PAGE_SUMMARY_SYSTEM = `You are a study assistant for UAE Grade 9-11 Physics and Biology (English).
Summarize ONE textbook page for revision and extract exactly what the student must know for exams.
Return ONLY JSON:
{
  "summary": string (3-5 sentences covering everything important on this page),
  "keyPoints": string[] (4-8 short bullet points: the page's must-know facts),
  "terms": [ { "term": string, "meaning": string } ] (important words introduced on the page WITH a short, Grade 9-11 appropriate meaning; empty if none),
  "examFocus": string[] (2-6 points most likely to be examined from this page: definitions to recall, formulas/calculations, processes, comparisons. Do NOT claim anything is guaranteed to be on the exam),
  "formulas": string[] (formulas exactly as printed on the page, e.g. "v = u + at"; empty for Biology unless a formula is present),
  "diagramInfo": string[] (what any diagram or table on the page shows and its key labels; empty if none)
}
Use ONLY what is on the page. Never invent content that is not supported by the page.`;

type PagePanel = {
  whatToKnow: string[];
  terms: { term: string; meaning: string }[];
  facts: string[];
  diagramInfo: string[];
  quickQuestions: string[];
  pageSummary?: string;
  examFocus?: string[];
  formulas?: string[];
};

function parsePanel(raw: string | null): PagePanel | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PagePanel> & { terms?: unknown };
    const terms = Array.isArray(parsed.terms)
      ? parsed.terms
          .map((t) =>
            typeof t === "string"
              ? { term: t, meaning: "" }
              : (t as { term?: unknown; meaning?: unknown }),
          )
          .filter((t): t is { term: string; meaning: string } => !!t && typeof t.term === "string")
          .map((t) => ({ term: t.term, meaning: typeof t.meaning === "string" ? t.meaning : "" }))
      : [];
    return {
      whatToKnow: Array.isArray(parsed.whatToKnow) ? parsed.whatToKnow.filter((s): s is string => typeof s === "string") : [],
      terms,
      facts: Array.isArray(parsed.facts) ? parsed.facts.filter((s): s is string => typeof s === "string") : [],
      diagramInfo: Array.isArray(parsed.diagramInfo)
        ? parsed.diagramInfo.filter((s): s is string => typeof s === "string")
        : [],
      quickQuestions: Array.isArray(parsed.quickQuestions)
        ? parsed.quickQuestions.filter((s): s is string => typeof s === "string")
        : [],
      pageSummary: typeof parsed.pageSummary === "string" ? parsed.pageSummary : undefined,
      examFocus: Array.isArray(parsed.examFocus)
        ? parsed.examFocus.filter((s): s is string => typeof s === "string")
        : [],
      formulas: Array.isArray(parsed.formulas)
        ? parsed.formulas.filter((s): s is string => typeof s === "string")
        : [],
    };
  } catch {
    return null;
  }
}

function safeHighlights(
  raw?: string | null,
): Array<{ text: string; priority: string; kind?: string; note?: string }> {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((h): h is Record<string, unknown> => !!h && typeof h === "object" && typeof (h as { text?: unknown }).text === "string")
      .map((h) => ({
        text: String(h.text),
        priority: typeof h.priority === "string" ? h.priority : "medium",
        kind: typeof h.kind === "string" ? h.kind : undefined,
        note: typeof h.note === "string" ? h.note : undefined,
      }));
  } catch {
    return [];
  }
}

/**
 * Generate and persist a rich per-page study panel (summary, word meanings,
 * exam focus, formulas). One small AI call per page keeps every page inside the
 * output limit. Returns true when a panel was saved.
 */
async function buildPagePanel(
  ctx: ActionCtx,
  userId: Id<"users">,
  pageId: Id<"pages">,
  text: string,
): Promise<boolean> {
  const raw = await callAI(
    [
      { role: "system", content: PAGE_SUMMARY_SYSTEM },
      { role: "user", content: `Textbook page transcription:\n\n${text.slice(0, 8000)}` },
    ],
    { maxTokens: 1600, temperature: 0.2 },
  );
  const parsed = extractJson<{
    summary?: unknown;
    keyPoints?: unknown;
    terms?: unknown;
    examFocus?: unknown;
    formulas?: unknown;
    diagramInfo?: unknown;
  }>(raw);
  const summary = typeof parsed.summary === "string" ? parsed.summary.slice(0, 1200) : "";
  if (!summary) return false;
  const strArr = (v: unknown, max: number) =>
    Array.isArray(v)
      ? v.filter((x): x is string => typeof x === "string" && !!x.trim()).slice(0, max)
      : [];
  const terms = Array.isArray(parsed.terms)
    ? parsed.terms
        .map((t) =>
          typeof t === "string"
            ? { term: t, meaning: "" }
            : (t as { term?: unknown; meaning?: unknown }),
        )
        .filter((t): t is { term: string; meaning: string } => !!t && typeof t.term === "string")
        .map((t) => ({
          term: t.term.slice(0, 120),
          meaning: typeof t.meaning === "string" ? t.meaning.slice(0, 400) : "",
        }))
        .slice(0, 10)
    : [];
  const keyPoints = strArr(parsed.keyPoints, 8);
  const examFocus = strArr(parsed.examFocus, 6);
  const formulas = strArr(parsed.formulas, 8);
  const diagramInfo = strArr(parsed.diagramInfo, 8);

  await ctx.runMutation(internal.studyAi.savePageStudyInternal, {
    userId,
    pageId,
    panel: JSON.stringify({
      whatToKnow: keyPoints,
      terms,
      facts: keyPoints,
      diagramInfo,
      quickQuestions: [],
      pageSummary: summary,
      examFocus,
      formulas,
    }),
  });
  return true;
}

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

// ---------------------------------------------------------------------------
// summarizeAllPages — guarantee a summary for EVERY page (one small AI call
// per page, so output limits can never truncate other pages' summaries)
// ---------------------------------------------------------------------------

export const summarizeAllPages = action({
  args: {
    pageIds: v.array(v.id("pages")),
  },
  handler: async (ctx, args): Promise<{ summarized: number; failed: number }> => {
    const user = await requireActionUser(ctx);
    let summarized = 0;
    let failed = 0;

    for (const pageId of args.pageIds.slice(0, 30)) {
      const page = await resolvePage(ctx, pageId, user._id);
      const rows = await ctx.runQuery(internal.studyAi.getPageAnalysisRows, {
        pageId,
        userId: user._id,
      });
      const fullText = rows[0]?.fullText ?? page.extractedText ?? "";
      if (!fullText) {
        failed++;
        continue;
      }

      try {
        const ok = await buildPagePanel(ctx, user._id, pageId, fullText);
        if (ok) summarized++;
        else failed++;
      } catch {
        failed++;
      }
    }

    return { summarized, failed };
  },
});

// ---------------------------------------------------------------------------
// createLessonFromPages — build a real lesson in the book from analysed pages:
// chapter → lesson → linked pages → lesson summary/terms/objectives + per-page
// study panels (summarizing any page that was skipped before)
// ---------------------------------------------------------------------------

const CHAPTER_TITLE_SYSTEM = `You name textbook chapters for UAE Grade 9-11 Physics and Biology (English).
Given page transcriptions, return ONLY JSON: { "title": string } where title is 2-6 words naming the chapter topic (e.g. "Forces and Motion", "Cells and Respiration"). Use only topics visible in the pages.`;

export const createLessonFromPages = action({
  args: {
    bookId: v.id("books"),
    pageIds: v.array(v.id("pages")),
    lessonTitle: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ lessonId: string; lessonTitle: string; summarized: number; failed: number }> => {
    const user = await requireActionUser(ctx);
    if (args.pageIds.length === 0) throw new Error("Select at least one page");

    // Load pages + analyses (max 12, reading order preserved)
    const loaded: Array<{ pageId: Id<"pages">; text: string }> = [];
    for (const pageId of args.pageIds.slice(0, 12)) {
      await resolvePage(ctx, pageId, user._id);
      const rows = await ctx.runQuery(internal.studyAi.getPageAnalysisRows, {
        pageId,
        userId: user._id,
      });
      const text = rows[0]?.fullText ?? "";
      if (text) loaded.push({ pageId, text });
    }
    if (loaded.length === 0) {
      throw new Error("None of these pages have been analysed yet. Run 'Highlight Important Things' first.");
    }

    // 1. Lesson title (or user-provided / page-detected fallback)
    let lessonTitle = args.lessonTitle?.trim() || "";
    if (!lessonTitle) {
      // Try the pages' detected lesson titles first (they come from the textbook)
      const detected = await ctx.runQuery(internal.studyAi.getPageTitles, {
        pageIds: loaded.map((l) => l.pageId),
      });
      lessonTitle = detected.find((t) => !!t) || "";
    }
    if (!lessonTitle) {
      try {
        const raw = await callAI(
          [
            { role: "system", content: CHAPTER_TITLE_SYSTEM },
            {
              role: "user",
              content: loaded.map((l) => l.text.slice(0, 1500)).join("\n\n---\n\n").slice(0, 9000),
            },
          ],
          { maxTokens: 100, temperature: 0.2 },
        );
        const parsed = extractJson<{ title?: unknown }>(raw);
        if (typeof parsed.title === "string" && parsed.title.trim()) {
          lessonTitle = parsed.title.trim().slice(0, 80);
        }
      } catch {
        // fallback below
      }
    }
    if (!lessonTitle) lessonTitle = "New Lesson";

    // 2. Chapter (first existing, else create)
    const chapterId = await ctx.runMutation(internal.studyAi.ensureChapter, {
      userId: user._id,
      bookId: args.bookId,
    });

    // 3. Lesson row
    const order = await ctx.runQuery(internal.studyAi.nextLessonOrder, { bookId: args.bookId });
    const lessonId = await ctx.runMutation(internal.studyAi.insertLessonRow, {
      userId: user._id,
      bookId: args.bookId,
      chapterId,
      title: lessonTitle,
      order,
    });

    // 4. Link pages to the lesson
    for (let i = 0; i < loaded.length; i++) {
      await ctx.runMutation(internal.studyAi.linkPageToLesson, {
        lessonId,
        pageId: loaded[i].pageId,
        order: i,
      });
    }

    // 5. Per-page summaries — one small AI call per page so every page gets one
    let summarized = 0;
    let failed = 0;
    for (const { pageId, text } of loaded) {
      // Skip pages that already have a study panel from an earlier run
      const existingPanel = await ctx.runQuery(internal.studyAi.getPageStudyInternal, {
        pageId,
        userId: user._id,
      });
      if (existingPanel) {
        summarized++;
        continue;
      }
      try {
        const ok = await buildPagePanel(ctx, user._id, pageId, text);
        if (ok) summarized++;
        else failed++;
      } catch {
        failed++;
      }
    }

    // 6. Lesson-level analysis (summary, key terms, objectives, must-know tiers)
    let lessonSummary: string | undefined;
    try {
      const raw = await callAI(
        [
          { role: "system", content: LESSON_SYSTEM },
          {
            role: "user",
            content: `Lesson: ${lessonTitle}\n\nPage transcriptions:\n${loaded
              .map((l) => l.text)
              .join("\n\n---\n\n")
              .slice(0, 45000)}`,
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

      lessonSummary = typeof parsed.summary === "string" ? parsed.summary.slice(0, 800) : undefined;

      await ctx.runMutation(internal.studyAi.updateLessonFields, {
        lessonId,
        summary: lessonSummary,
        keyTerms: JSON.stringify(strArr(parsed.keyTerms, 10)),
        formulas: JSON.stringify(strArr(parsed.formulas, 12)),
        objectives: JSON.stringify(strArr(parsed.objectives, 8)),
      });

      const tiers: Array<{ level: "must_know" | "important" | "extra"; items: unknown }> = [
        { level: "must_know", items: parsed.mustKnow },
        { level: "important", items: parsed.important },
        { level: "extra", items: parsed.extra },
      ];
      await ctx.runMutation(internal.studyAi.clearLessonInfo, { lessonId });
      let infoOrder = 0;
      for (const tier of tiers) {
        for (const text of strArr(tier.items, 12)) {
          await ctx.runMutation(internal.studyAi.insertLessonInfo, {
            userId: user._id,
            lessonId,
            level: tier.level,
            content: text,
            order: infoOrder++,
          });
        }
      }
    } catch {
      // Lesson works even if the big analysis fails — pages are linked and summarized
    }

    return {
      lessonId: String(lessonId),
      lessonTitle,
      summarized,
      failed,
    };
  },
});

// ---------------------------------------------------------------------------
// generatePagesQuiz — a quiz built from the important content of every page
// (highlights + per-page terms, exam focus and key points)
// ---------------------------------------------------------------------------

function parseQuizQuestions(raw: string, count: number) {
  const parsed = extractJson<{ questions?: unknown }>(raw);
  return Array.isArray(parsed.questions)
    ? parsed.questions
        .map((q) => q as Record<string, unknown>)
        .filter(
          (q): q is {
            questionText: string;
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
        .slice(0, count)
    : [];
}

export const generatePagesQuiz = action({
  args: {
    pageIds: v.array(v.id("pages")),
    count: v.union(v.literal(5), v.literal(10), v.literal(15), v.literal(20)),
    difficulty: v.union(
      v.literal("easy"), v.literal("medium"), v.literal("hard"), v.literal("mixed"),
    ),
  },
  handler: async (ctx, args) => {
    const user = await requireActionUser(ctx);
    const chunks: string[] = [];
    for (const pageId of args.pageIds.slice(0, 12)) {
      await resolvePage(ctx, pageId, user._id);
      const rows = await ctx.runQuery(internal.studyAi.getPageAnalysisRows, {
        pageId,
        userId: user._id,
      });
      const panelRaw = await ctx.runQuery(internal.studyAi.getPageStudyPanel, {
        pageId,
        userId: user._id,
      });
      const panel = parsePanel(panelRaw);
      const label = rows[0]?.pageNumber ? `Page ${rows[0].pageNumber}` : `Page ${chunks.length + 1}`;
      const lines: string[] = [];
      const hl = safeHighlights(rows[0]?.highlights);
      if (hl.length) lines.push(`Highlights: ${hl.map((h) => h.text).join(" | ")}`);
      if (panel?.examFocus?.length) lines.push(`Exam focus: ${panel.examFocus.join(" | ")}`);
      if (panel?.terms?.length)
        lines.push(`Terms: ${panel.terms.map((t) => `${t.term} = ${t.meaning}`).join(" | ")}`);
      if (panel?.whatToKnow?.length) lines.push(`Key points: ${panel.whatToKnow.join(" | ")}`);
      if (rows[0]?.fullText) lines.push(`Text: ${rows[0].fullText.slice(0, 2500)}`);
      if (lines.length) chunks.push(`${label}:\n${lines.join("\n")}`);
    }
    if (chunks.length === 0) {
      throw new Error("No analysed pages found. Run 'Highlight All Pages' first.");
    }

    const raw = await callAI(
      [
        { role: "system", content: QUIZ_SYSTEM },
        {
          role: "user",
          content: `Difficulty: ${args.difficulty}. Write exactly ${args.count} questions covering these pages.\n\n${chunks.join("\n\n---\n\n").slice(0, 14000)}`,
        },
      ],
      { maxTokens: 3000, temperature: 0.3 },
    );
    const questions = parseQuizQuestions(raw, args.count);
    if (questions.length === 0) throw new Error("The AI could not create a quiz from these pages");
    return { questions };
  },
});
