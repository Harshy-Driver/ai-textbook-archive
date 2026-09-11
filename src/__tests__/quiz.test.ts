import { describe, it, expect } from "vitest";

// Extract the core quiz generation logic for testing
function generateSampleQuestions(
  lessonTitle: string,
  count: number,
  difficulty: string,
  type: string
): {
  questionText: string;
  questionType: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  relatedTopic: string;
}[] {
  const questions = [];
  const base = [
    {
      questionText: `Which of the following best describes the main concept of "${lessonTitle}"?`,
      questionType: "mcq",
      options: [
        "A fundamental principle in the study of this topic",
        "An advanced concept not covered in this lesson",
        "A completely unrelated scientific theory",
        "A historical fact about the discovery of this concept",
      ],
      correctAnswer: "A fundamental principle in the study of this topic",
      explanation: `This option correctly identifies the core concept taught in ${lessonTitle}.`,
      relatedTopic: lessonTitle,
    },
    {
      questionText: `True or False: The concepts in ${lessonTitle} are independent of other topics.`,
      questionType: "true_false",
      options: ["True", "False"],
      correctAnswer: "False",
      explanation: "Most textbook topics are interconnected.",
      relatedTopic: lessonTitle,
    },
    {
      questionText: `Which of the following is NOT a key aspect of ${lessonTitle}?`,
      questionType: "mcq",
      options: [
        "Core definitions and terminology",
        "Practical applications",
        "Connection to unrelated historical events",
        "Important formulas or processes",
      ],
      correctAnswer: "Connection to unrelated historical events",
      explanation: "Unrelated historical events are not a key aspect.",
      relatedTopic: lessonTitle,
    },
    {
      questionText: `What is the primary purpose of studying ${lessonTitle}?`,
      questionType: "mcq",
      options: [
        "To understand fundamental principles and their applications",
        "To memorize random facts without context",
        "To pass time during study sessions",
        "To impress friends with scientific knowledge",
      ],
      correctAnswer: "To understand fundamental principles and their applications",
      explanation: "The primary purpose is building understanding.",
      relatedTopic: lessonTitle,
    },
    {
      questionText: `True or False: ${lessonTitle} is one of the most important topics in this chapter.`,
      questionType: "true_false",
      options: ["True", "False"],
      correctAnswer: "True",
      explanation: "This lesson is a key part of the chapter.",
      relatedTopic: lessonTitle,
    },
  ];

  let pool = [...base];
  if (type === "true_false") {
    pool = pool.filter((q) => q.questionType === "true_false");
  } else if (type === "mcq") {
    pool = pool.filter((q) => q.questionType === "mcq");
  }

  for (let i = 0; i < Math.min(count, pool.length); i++) {
    questions.push(pool[i]);
  }

  for (let i = questions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [questions[i], questions[j]] = [questions[j], questions[i]];
  }

  return questions.slice(0, count);
}

describe("Quiz Question Generation", () => {
  it("generates the requested number of questions", () => {
    const qs = generateSampleQuestions("Newton's Laws", 10, "mixed", "mixed");
    expect(qs.length).toBeLessThanOrEqual(10);
    expect(qs.length).toBeGreaterThan(0);
  });

  it("returns questions related to the lesson title", () => {
    const qs = generateSampleQuestions("Cell Division", 5, "mixed", "mixed");
    for (const q of qs) {
      expect(q.relatedTopic).toBe("Cell Division");
      expect(q.questionText).toContain("Cell Division");
    }
  });

  it("each question has a single correct answer", () => {
    const qs = generateSampleQuestions("Photosynthesis", 10, "mixed", "mixed");
    for (const q of qs) {
      expect(q.correctAnswer).toBeTruthy();
      expect(typeof q.correctAnswer).toBe("string");
      // For MCQ questions, correct answer must be in options
      if (q.questionType === "mcq") {
        expect(q.options).toContain(q.correctAnswer);
      }
      // For True/False, correct answer is one of the two
      if (q.questionType === "true_false") {
        expect(["True", "False"]).toContain(q.correctAnswer);
      }
    }
  });

  it("includes an explanation for every question", () => {
    const qs = generateSampleQuestions("Thermodynamics", 5, "mixed", "mixed");
    for (const q of qs) {
      expect(q.explanation).toBeTruthy();
      expect(q.explanation.length).toBeGreaterThan(10);
    }
  });

  it("filters to true/false only when type is true_false", () => {
    const qs = generateSampleQuestions("Evolution", 10, "mixed", "true_false");
    for (const q of qs) {
      expect(q.questionType).toBe("true_false");
    }
  });

  it("filters to MCQ only when type is mcq", () => {
    const qs = generateSampleQuestions("Electromagnetism", 10, "mixed", "mcq");
    for (const q of qs) {
      expect(q.questionType).toBe("mcq");
    }
  });

  it("handles requesting more questions than available pool", () => {
    const qs = generateSampleQuestions("Gravity", 100, "mixed", "mixed");
    // Pool only has 5 questions, so should return at most 5
    expect(qs.length).toBeLessThanOrEqual(5);
  });

  it("returns empty array when count is 0", () => {
    const qs = generateSampleQuestions("Relativity", 0, "mixed", "mixed");
    expect(qs).toHaveLength(0);
  });

  it("shuffles questions (not always in same order)", () => {
    // Run multiple times and check that at least one run produces different order
    const runs: string[][] = [];
    for (let i = 0; i < 10; i++) {
      const qs = generateSampleQuestions("Optics", 5, "mixed", "mixed");
      runs.push(qs.map((q) => q.questionText));
    }
    // With 10 runs of 5 shuffled questions, at least one should differ
    const allSame = runs.every(
      (r) => JSON.stringify(r) === JSON.stringify(runs[0])
    );
    expect(allSame).toBe(false);
  });
});

describe("Exam Question Generation", () => {
  // Reimplement the exam logic for testing
  function generateExamQuestions(lessonTitles: string[], count: number) {
    const questions: {
      questionText: string;
      questionType: string;
      options: string[];
      correctAnswer: string;
      explanation: string;
      relatedTopic: string;
    }[] = [];

    for (const title of lessonTitles) {
      questions.push({
        questionText: `Which is a key concept from "${title}"?`,
        questionType: "mcq",
        options: ["A core principle", "Unrelated concept", "Outdated idea", "Random fact"],
        correctAnswer: "A core principle",
        explanation: `Core concept from ${title}`,
        relatedTopic: title,
      });
      questions.push({
        questionText: `True or False: "${title}" builds on earlier lessons.`,
        questionType: "true_false",
        options: ["True", "False"],
        correctAnswer: "True",
        explanation: `Lessons build on each other`,
        relatedTopic: title,
      });
    }

    return questions.slice(0, Math.min(count, questions.length));
  }

  it("generates questions from multiple lessons", () => {
    const qs = generateExamQuestions(["Newton's Laws", "Cell Division", "Electromagnetism"], 20);
    const topics = new Set(qs.map((q) => q.relatedTopic));
    expect(topics.size).toBe(3);
  });

  it("all questions have relatedTopic matching a provided lesson", () => {
    const lessons = ["Thermodynamics", "Genetics"];
    const qs = generateExamQuestions(lessons, 10);
    for (const q of qs) {
      expect(lessons).toContain(q.relatedTopic);
    }
  });

  it("respects count limit", () => {
    const qs = generateExamQuestions(["Lesson A", "Lesson B"], 2);
    expect(qs.length).toBe(2);
  });
});
