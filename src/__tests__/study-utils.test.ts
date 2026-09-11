import { describe, it, expect } from "vitest";

// Test checklist status cycling logic
function cycleStatus(current: string): string {
  if (current === "not_started") return "studying";
  if (current === "studying") return "completed";
  return "not_started";
}

// Test progress calculation
function calcProgress(completed: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((completed / total) * 100);
}

// Test score percentage
function calcScore(correct: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((correct / total) * 100);
}

// Test exam date calculation
function daysUntilExam(examDate: Date): number {
  const now = Date.now();
  return Math.max(0, Math.ceil((examDate.getTime() - now) / (1000 * 60 * 60 * 24)));
}

// Test search filtering
function filterLessons(
  lessons: { title: string; summary?: string; keyTerms?: string }[],
  query: string
): { title: string; summary?: string; keyTerms?: string }[] {
  const q = query.toLowerCase();
  return lessons.filter(
    (l) =>
      l.title.toLowerCase().includes(q) ||
      (l.summary && l.summary.toLowerCase().includes(q)) ||
      (l.keyTerms && l.keyTerms.toLowerCase().includes(q))
  );
}

describe("Checklist Status Cycling", () => {
  it("cycles not_started → studying", () => {
    expect(cycleStatus("not_started")).toBe("studying");
  });

  it("cycles studying → completed", () => {
    expect(cycleStatus("studying")).toBe("completed");
  });

  it("cycles completed → not_started", () => {
    expect(cycleStatus("completed")).toBe("not_started");
  });

  it("handles invalid status gracefully", () => {
    // Should default to not_started for unknown
    expect(cycleStatus("unknown")).toBe("not_started");
  });
});

describe("Progress Calculation", () => {
  it("calculates correct percentage", () => {
    expect(calcProgress(5, 10)).toBe(50);
  });

  it("returns 0 for no items", () => {
    expect(calcProgress(0, 0)).toBe(0);
  });

  it("returns 0 when total is 0", () => {
    expect(calcProgress(5, 0)).toBe(0);
  });

  it("returns 100 for all complete", () => {
    expect(calcProgress(10, 10)).toBe(100);
  });

  it("rounds correctly", () => {
    expect(calcProgress(1, 3)).toBe(33);
    expect(calcProgress(2, 3)).toBe(67);
  });
});

describe("Quiz Score Calculation", () => {
  it("calculates correct percentage", () => {
    expect(calcScore(8, 10)).toBe(80);
  });

  it("returns 0 when total is 0", () => {
    expect(calcScore(0, 0)).toBe(0);
  });

  it("returns 100 for perfect score", () => {
    expect(calcScore(20, 20)).toBe(100);
  });

  it("returns 0 for no correct answers", () => {
    expect(calcScore(0, 10)).toBe(0);
  });
});

describe("Exam Date Calculation", () => {
  it("calculates days until future date", () => {
    const future = new Date();
    future.setDate(future.getDate() + 7);
    expect(daysUntilExam(future)).toBe(7);
  });

  it("returns 0 for past date", () => {
    const past = new Date();
    past.setDate(past.getDate() - 3);
    expect(daysUntilExam(past)).toBe(0);
  });

  it("returns 0 for today", () => {
    const today = new Date();
    today.setHours(today.getHours() - 1); // 1 hour ago
    expect(daysUntilExam(today)).toBe(0);
  });
});

describe("Lesson Search Filtering", () => {
  const lessons = [
    { title: "Newton's Laws of Motion", summary: "Understanding force and acceleration", keyTerms: "force mass acceleration" },
    { title: "Cell Division", summary: "Mitosis and meiosis processes", keyTerms: "chromosome mitosis meiosis" },
    { title: "Electromagnetic Waves", summary: "Properties of light and radiation", keyTerms: "wavelength frequency amplitude" },
  ];

  it("finds lesson by title", () => {
    const results = filterLessons(lessons, "Newton");
    expect(results).toHaveLength(1);
    expect(results[0].title).toContain("Newton");
  });

  it("finds lesson by summary keyword", () => {
    const results = filterLessons(lessons, "force");
    expect(results).toHaveLength(1);
    expect(results[0].title).toContain("Newton");
  });

  it("finds lesson by key terms", () => {
    const results = filterLessons(lessons, "chromosome");
    expect(results).toHaveLength(1);
    expect(results[0].title).toContain("Cell Division");
  });

  it("returns empty for no matches", () => {
    const results = filterLessons(lessons, "quantum entanglement");
    expect(results).toHaveLength(0);
  });

  it("is case-insensitive", () => {
    const results = filterLessons(lessons, "MITOSIS");
    expect(results).toHaveLength(1);
  });

  it("finds multiple matching lessons", () => {
    const results = filterLessons(lessons, "a");
    // All lessons have 'a' in title or content
    expect(results.length).toBeGreaterThanOrEqual(2);
  });
});
