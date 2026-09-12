import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { Infer, v } from "convex/values";

export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MEMBER: "member",
} as const;

export const roleValidator = v.union(
  v.literal(ROLES.ADMIN),
  v.literal(ROLES.USER),
  v.literal(ROLES.MEMBER),
);
export type Role = Infer<typeof roleValidator>;

const schema = defineSchema(
  {
    ...authTables,

    users: defineTable({
      name: v.optional(v.string()),
      image: v.optional(v.string()),
      email: v.optional(v.string()),
      emailVerificationTime: v.optional(v.number()),
      isAnonymous: v.optional(v.boolean()),
      role: v.optional(roleValidator),
      // StudyAI profile fields
      grade: v.optional(v.union(v.literal(9), v.literal(10), v.literal(11))),
      subject: v.optional(v.union(v.literal("physics"), v.literal("biology"))),
      curriculum: v.optional(v.union(v.literal("general"), v.literal("advanced"))),
      language: v.optional(v.string()),
      onboardingCompleted: v.optional(v.boolean()),
      studyIntensity: v.optional(v.union(
        v.literal("light"),
        v.literal("balanced"),
        v.literal("exam_focus"),
      )),
    }).index("email", ["email"]),

    // Books uploaded by users
    books: defineTable({
      userId: v.id("users"),
      title: v.string(),
      grade: v.number(),
      subject: v.string(),
      curriculum: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
    }).index("by_user", ["userId"]),

    // Uploaded textbook pages
    pages: defineTable({
      userId: v.id("users"),
      bookId: v.id("books"),
      imageUrl: v.string(),
      order: v.number(),
      chapterTitle: v.optional(v.string()),
      unitTitle: v.optional(v.string()),
      lessonTitle: v.optional(v.string()),
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
      createdAt: v.number(),
    }).index("by_book", ["bookId"])
      .index("by_user", ["userId"]),

    // Organized units
    units: defineTable({
      userId: v.id("users"),
      bookId: v.id("books"),
      title: v.string(),
      order: v.number(),
      term: v.optional(v.string()),
    }).index("by_book", ["bookId"]),

    // Chapters within units
    chapters: defineTable({
      userId: v.id("users"),
      bookId: v.id("books"),
      unitId: v.optional(v.id("units")),
      title: v.string(),
      order: v.number(),
    }).index("by_unit", ["unitId"])
      .index("by_book", ["bookId"]),

    // Lessons within chapters
    lessons: defineTable({
      userId: v.id("users"),
      bookId: v.id("books"),
      chapterId: v.id("chapters"),
      title: v.string(),
      order: v.number(),
      summary: v.optional(v.string()),
      keyTerms: v.optional(v.string()), // JSON array
      formulas: v.optional(v.string()), // JSON array
      objectives: v.optional(v.string()), // JSON array
      importanceLevel: v.optional(v.string()),
    }).index("by_chapter", ["chapterId"])
      .index("by_book", ["bookId"])
      .index("by_user", ["userId"]),

    // Pages associated with lessons
    lessonPages: defineTable({
      lessonId: v.id("lessons"),
      pageId: v.id("pages"),
      order: v.number(),
    }).index("by_lesson", ["lessonId"]),

    // Study checklist items for lessons
    studyChecklist: defineTable({
      userId: v.id("users"),
      lessonId: v.id("lessons"),
      text: v.string(),
      category: v.optional(v.string()),
      status: v.union(
        v.literal("not_started"),
        v.literal("studying"),
        v.literal("completed"),
      ),
      order: v.number(),
    }).index("by_lesson_user", ["lessonId", "userId"]),

    // Important information sections per lesson
    lessonInfo: defineTable({
      userId: v.id("users"),
      lessonId: v.id("lessons"),
      level: v.union(
        v.literal("must_know"),
        v.literal("important"),
        v.literal("extra"),
      ),
      content: v.string(),
      sourcePageId: v.optional(v.id("pages")),
      order: v.number(),
    }).index("by_lesson_user", ["lessonId", "userId"]),

    // Quiz attempts
    quizAttempts: defineTable({
      userId: v.id("users"),
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
      answers: v.string(), // JSON array of user answers
      completedAt: v.number(),
      duration: v.optional(v.number()),
      bookId: v.optional(v.id("books")),
      chapterIds: v.optional(v.string()), // JSON array of chapter IDs
    }).index("by_user", ["userId"])
      .index("by_lesson", ["lessonId"])
      .index("by_user_lesson", ["userId", "lessonId"]),

    // Quiz questions (stored for review)
    quizQuestions: defineTable({
      attemptId: v.id("quizAttempts"),
      questionIndex: v.number(),
      questionText: v.string(),
      questionType: v.string(),
      options: v.optional(v.string()), // JSON array
      correctAnswer: v.string(),
      userAnswer: v.optional(v.string()),
      explanation: v.string(),
      relatedTopic: v.optional(v.string()),
      lessonId: v.id("lessons"),
    }).index("by_attempt", ["attemptId"]),

    // Flashcards
    flashcards: defineTable({
      userId: v.id("users"),
      lessonId: v.id("lessons"),
      front: v.string(),
      back: v.string(),
      known: v.optional(v.boolean()),
      forReview: v.optional(v.boolean()),
      order: v.number(),
    }).index("by_lesson_user", ["lessonId", "userId"]),

    // Study plans
    studyPlans: defineTable({
      userId: v.id("users"),
      title: v.string(),
      examDate: v.number(),
      createdAt: v.number(),
      isActive: v.boolean(),
    }).index("by_user", ["userId"]),

    // Study plan sessions
    studyPlanSessions: defineTable({
      planId: v.id("studyPlans"),
      userId: v.id("users"),
      date: v.number(),
      lessonId: v.optional(v.id("lessons")),
      subject: v.string(),
      topic: v.string(),
      durationMinutes: v.number(),
      completed: v.boolean(),
      order: v.number(),
    }).index("by_plan", ["planId"])
      .index("by_user_date", ["userId", "date"]),

    // Study progress tracking
    studyProgress: defineTable({
      userId: v.id("users"),
      lessonId: v.id("lessons"),
      progressPercent: v.number(),
      studyMinutes: v.number(),
      lastStudied: v.number(),
      totalStudySessions: v.number(),
    }).index("by_user_lesson", ["userId", "lessonId"])
      .index("by_user", ["userId"]),

    // AI chat messages per lesson
    chatMessages: defineTable({
      userId: v.id("users"),
      lessonId: v.id("lessons"),
      role: v.union(v.literal("user"), v.literal("assistant")),
      content: v.string(),
      timestamp: v.number(),
    }).index("by_lesson_user", ["lessonId", "userId"]),

    // Exam mode attempts
    examAttempts: defineTable({
      userId: v.id("users"),
      lessonIds: v.string(), // JSON array of lesson IDs
      totalQuestions: v.number(),
      score: v.number(),
      percentage: v.number(),
      completedAt: v.number(),
      answers: v.string(), // JSON
    }).index("by_user", ["userId"]),

    // ---- Smart Highlights & Study Files ----

    // Cached AI analysis of a single textbook page (OCR + highlights), keyed by
    // a hash of the compressed image so re-uploads of the same page reuse it.
    pageAnalysis: defineTable({
      userId: v.id("users"),
      pageId: v.id("pages"),
      textHash: v.string(), // deterministic hash of the page image content
      fullText: v.string(), // exact transcription of readable text
      pageNumber: v.optional(v.number()), // only when visible in the photo
      ocrConfidence: v.number(),
      readability: v.union(
        v.literal("clear"),
        v.literal("partially_readable"),
        v.literal("unreadable"),
      ),
      readabilityNote: v.optional(v.string()),
      highlights: v.optional(v.string()), // JSON array of PageHighlight
      updatedAt: v.number(),
    }).index("by_page", ["pageId"])
      .index("by_user_hash", ["userId", "textHash"]),

    // Generated study documents (lesson, page, or chapter scope)
    studyFiles: defineTable({
      userId: v.id("users"),
      title: v.string(),
      subject: v.string(),
      grade: v.number(),
      chapterTitle: v.optional(v.string()),
      unitTitle: v.optional(v.string()),
      scope: v.union(
        v.literal("lesson"),
        v.literal("page"),
        v.literal("pages"),
        v.literal("chapter"),
      ),
      pageIds: v.string(), // JSON array of page ids in reading order
      sections: v.string(), // JSON array of StudyFileSection
      pageCount: v.number(),
      createdAt: v.number(),
      updatedAt: v.number(),
    }).index("by_user", ["userId"]),

    // Per-page "Study This Page" panel (small study material per page)
    pageStudy: defineTable({
      userId: v.id("users"),
      pageId: v.id("pages"),
      panel: v.string(), // JSON: whatToKnow, terms, facts, diagramInfo, quickQuestions
      updatedAt: v.number(),
    }).index("by_page", ["pageId"]),

    // Flashcards generated from highlights (standalone, page-scoped)
    highlightFlashcards: defineTable({
      userId: v.id("users"),
      pageId: v.optional(v.id("pages")),
      source: v.string(), // "highlights"
      front: v.string(),
      back: v.string(),
      createdAt: v.number(),
    }).index("by_page", ["pageId"])
      .index("by_user", ["userId"]),

    // Daily statistics
    dailyStats: defineTable({
      userId: v.id("users"),
      date: v.string(), // YYYY-MM-DD
      studyMinutes: v.number(),
      quizzesTaken: v.number(),
      quizzesCorrect: v.number(),
      lessonsStudied: v.number(),
    }).index("by_user_date", ["userId", "date"]),
  },
  {
    schemaValidation: false,
  },
);

export default schema;
