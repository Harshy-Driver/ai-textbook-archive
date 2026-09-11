export type Grade = 9 | 10 | 11;
export type Subject = "physics" | "biology";
export type Curriculum = "general" | "advanced";
export type ChecklistStatus = "not_started" | "studying" | "completed";
export type InfoLevel = "must_know" | "important" | "extra";
export type QuizMode = "lesson" | "exam" | "page" | "weak_topics";
export type QuizDifficulty = "easy" | "medium" | "hard" | "mixed";
export type QuestionType = "mcq" | "true_false" | "multi_select" | "calculation" | "reasoning" | "mixed";

export interface QuizQuestion {
  questionText: string;
  questionType: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
  relatedTopic?: string;
}

export interface QuizConfig {
  questionCount: number;
  difficulty: QuizDifficulty;
  questionTypes: QuestionType;
  lessonId?: string;
  chapterIds?: string[];
}

export interface FlashcardData {
  front: string;
  back: string;
}

export interface StudySession {
  date: number;
  lessonId?: string;
  subject: string;
  topic: string;
  durationMinutes: number;
  completed: boolean;
  order: number;
}

export const GRADES: Grade[] = [9, 10, 11];
export const SUBJECTS: { value: Subject; label: string }[] = [
  { value: "physics", label: "Physics" },
  { value: "biology", label: "Biology" },
];
export const CURRICULA: { value: Curriculum; label: string }[] = [
  { value: "general", label: "UAE General" },
  { value: "advanced", label: "UAE Advanced" },
];
