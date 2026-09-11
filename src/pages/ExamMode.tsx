import { useState, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Trophy,
  CheckCircle2,
  XCircle,
  Sparkles,
  Clock,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Id } from "@/convex/_generated/dataModel";

interface ExamQuestion {
  questionText: string;
  questionType: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  relatedTopic: string;
}

const generateExamQuestions = (
  lessonTitles: string[],
  count: number
): ExamQuestion[] => {
  const questions: ExamQuestion[] = [];
  const pool: ExamQuestion[] = [];

  for (const title of lessonTitles) {
    pool.push(
      {
        questionText: `Which of the following is a key concept from "${title}"?`,
        questionType: "mcq",
        options: [
          "A core principle taught in this lesson",
          "An unrelated scientific concept",
          "A historical event not covered in this chapter",
          "An advanced topic from a higher grade level",
        ],
        correctAnswer: "A core principle taught in this lesson",
        explanation: `This is a foundational concept from ${title} that students must understand.`,
        relatedTopic: title,
      },
      {
        questionText: `True or False: The topics in "${title}" are interconnected with other lessons in the chapter.`,
        questionType: "true_false",
        options: ["True", "False"],
        correctAnswer: "True",
        explanation: `Most textbook topics build on each other. Understanding ${title} provides context for related concepts.`,
        relatedTopic: title,
      },
      {
        questionText: `Which approach is most effective when studying "${title}"?`,
        questionType: "mcq",
        options: [
          "Reviewing uploaded textbook pages and practicing problems",
          "Memorizing only definitions without understanding",
          "Skipping the reading section entirely",
          "Studying topics from unrelated chapters first",
        ],
        correctAnswer: "Reviewing uploaded textbook pages and practicing problems",
        explanation: "Active engagement with source material through reading and practice leads to better understanding.",
        relatedTopic: title,
      },
      {
        questionText: `What should a student focus on when reviewing "${title}"?`,
        questionType: "reasoning",
        options: [
          "Understanding key concepts, definitions, and their applications",
          "Only memorizing specific numbers without context",
          "Reading the table of contents without studying content",
          "Focusing on topics from different subjects",
        ],
        correctAnswer: "Understanding key concepts, definitions, and their applications",
        explanation: "Deep understanding of concepts and their real-world applications is more effective than surface-level memorization.",
        relatedTopic: title,
      },
      {
        questionText: `In the context of "${title}", which statement is most accurate?`,
        questionType: "mcq",
        options: [
          "The lesson covers interconnected concepts that build upon each other",
          "Each topic is completely independent of all others",
          "The material is only useful in laboratory settings",
          "The concepts are outdated and no longer relevant",
        ],
        correctAnswer: "The lesson covers interconnected concepts that build upon each other",
        explanation: "Textbook lessons are structured so that concepts connect and build on previous understanding.",
        relatedTopic: title,
      },
      {
        questionText: `True or False: Mastering "${title}" requires both understanding and application of the concepts.`,
        questionType: "true_false",
        options: ["True", "False"],
        correctAnswer: "True",
        explanation: "Effective learning requires both conceptual understanding and the ability to apply knowledge in different contexts.",
        relatedTopic: title,
      },
      {
        questionText: `When answering questions about "${title}", which evidence is most reliable?`,
        questionType: "mcq",
        options: [
          "Information from the uploaded textbook pages",
          "General knowledge from unrelated online sources",
          "Guessing based on the question wording",
          "Answers from students studying different curricula",
        ],
        correctAnswer: "Information from the uploaded textbook pages",
        explanation: "Your uploaded textbook is the primary source of truth for curriculum-specific information.",
        relatedTopic: title,
      },
      {
        questionText: `Which skill is most important when studying "${title}" for an exam?`,
        questionType: "mcq",
        options: [
          "Critical thinking and application of concepts",
          "Memorizing page numbers without content",
          "Reading only the chapter titles",
          "Skipping practice questions",
        ],
        correctAnswer: "Critical thinking and application of concepts",
        explanation: "Critical thinking allows you to apply concepts in various scenarios, which is essential for exam success.",
        relatedTopic: title,
      },
      {
        questionText: `True or False: "${title}" builds on concepts from earlier lessons in the same chapter.`,
        questionType: "true_false",
        options: ["True", "False"],
        correctAnswer: "True",
        explanation: "Textbook chapters are typically structured sequentially, with later lessons building on earlier ones.",
        relatedTopic: title,
      },
      {
        questionText: `What is the recommended study method for "${title}"?`,
        questionType: "mcq",
        options: [
          "Review the summary, study key terms, and practice with quizzes",
          "Skip to the end-of-chapter questions without reading",
          "Only read the introduction section",
          "Study without taking any notes",
        ],
        correctAnswer: "Review the summary, study key terms, and practice with quizzes",
        explanation: "A comprehensive approach including review, terminology, and practice leads to the best retention.",
        relatedTopic: title,
      }
    );
  }

  // Shuffle and select
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  return pool.slice(0, Math.min(count, pool.length));
};

export default function ExamMode() {
  const allLessons = useQuery(api.lessons.listUserLessons);
  const recordAttempt = useMutation(api.quizzes.recordAttempt);

  const [phase, setPhase] = useState<"select" | "taking" | "results" | "review">("select");
  const [selectedLessons, setSelectedLessons] = useState<Set<string>>(new Set());
  const [questionCount, setQuestionCount] = useState(20);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [showAnswer, setShowAnswer] = useState(false);
  const [startTime, setStartTime] = useState(0);

  const toggleLesson = (id: string) => {
    setSelectedLessons((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const startExam = useCallback(() => {
    if (selectedLessons.size === 0) return;
    const titles = (allLessons ?? [])
      .filter((l) => selectedLessons.has(l._id))
      .map((l) => l.title);
    const qs = generateExamQuestions(titles, questionCount);
    setQuestions(qs);
    setCurrentIdx(0);
    setUserAnswers({});
    setShowAnswer(false);
    setStartTime(Date.now());
    setPhase("taking");
  }, [selectedLessons, questionCount, allLessons]);

  const selectAnswer = (idx: number, answer: string) => {
    if (showAnswer) return;
    setUserAnswers((prev) => ({ ...prev, [idx]: answer }));
  };

  const goNext = () => {
    if (currentIdx < questions.length - 1) {
      setShowAnswer(false);
      setCurrentIdx(currentIdx + 1);
    } else {
      finishExam();
    }
  };

  const finishExam = async () => {
    let correct = 0;
    questions.forEach((q, i) => {
      if (userAnswers[i] === q.correctAnswer) correct++;
    });
    const percentage = Math.round((correct / questions.length) * 100);
    const duration = Math.round((Date.now() - startTime) / 1000);

    // Record against the first selected lesson
    const firstLessonId = [...selectedLessons][0];
    if (firstLessonId) {
      try {
        await recordAttempt({
          lessonId: firstLessonId as Id<"lessons">,
          mode: "exam",
          questionCount: questions.length,
          difficulty: "mixed",
          questionTypes: "mixed",
          score: correct,
          totalQuestions: questions.length,
          percentage,
          answers: JSON.stringify(userAnswers),
          duration,
        });
      } catch (e) {
        console.error(e);
      }
    }
    setPhase("results");
  };

  const score = questions.filter((q, i) => userAnswers[i] === q.correctAnswer).length;
  const percentage = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;
  const current = questions[currentIdx];

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
        <AnimatePresence mode="wait">
          {/* Selection Phase */}
          {phase === "select" && (
            <motion.div key="select" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="mb-6">
                <h1 className="font-serif-vintage text-2xl sm:text-3xl font-bold text-foreground">
                  Exam Mode
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Create a comprehensive exam from multiple lessons
                </p>
              </div>

              <Card className="vintage-card mb-6">
                <CardContent className="p-6 space-y-5">
                  {/* Select Lessons */}
                  <div>
                    <Label className="text-sm font-medium block mb-3">
                      Select Lessons to Include
                    </Label>
                    {!allLessons || allLessons.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">
                        No lessons available. Upload textbooks and organize pages first.
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {allLessons.map((lesson) => (
                          <label
                            key={lesson._id}
                            className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/30 transition-colors cursor-pointer"
                          >
                            <Checkbox
                              checked={selectedLessons.has(lesson._id)}
                              onCheckedChange={() => toggleLesson(lesson._id)}
                            />
                            <span className="text-sm font-medium text-foreground">{lesson.title}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Question Count */}
                  <div>
                    <Label className="text-sm font-medium block mb-2">
                      Total Questions
                    </Label>
                    <div className="flex gap-2">
                      {[10, 20, 30, 40].map((n) => (
                        <button
                          key={n}
                          onClick={() => setQuestionCount(n)}
                          className={`flex-1 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                            questionCount === n
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border hover:border-primary/30"
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>

                  <Button
                    onClick={startExam}
                    disabled={selectedLessons.size === 0}
                    className="w-full gap-2"
                    size="lg"
                  >
                    <Sparkles className="h-4 w-4" />
                    Start Exam ({selectedLessons.size} lesson{selectedLessons.size !== 1 ? "s" : ""})
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Taking Phase */}
          {phase === "taking" && current && (
            <motion.div
              key={`exam-q-${currentIdx}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Question {currentIdx + 1} of {questions.length}
                </span>
                <span className="text-sm font-medium text-primary">{Math.round(((currentIdx + 1) / questions.length) * 100)}%</span>
              </div>
              <div className="progress-vintage h-1.5 mb-6">
                <div className="progress-vintage-fill transition-all duration-300" style={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }} />
              </div>

              <Card className="vintage-card">
                <CardContent className="p-6">
                  <span className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground px-2 py-1 bg-secondary rounded mb-3 inline-block">
                    {current.relatedTopic}
                  </span>
                  <h2 className="font-serif-vintage text-lg font-bold text-foreground mt-2 mb-5">
                    {current.questionText}
                  </h2>

                  <div className="space-y-2.5">
                    {current.options.map((opt, i) => {
                      const letter = String.fromCharCode(65 + i);
                      const isSelected = userAnswers[currentIdx] === opt;
                      const isCorrect = opt === current.correctAnswer;
                      let cls = "quiz-option";
                      if (showAnswer && isCorrect) cls += " correct";
                      else if (showAnswer && isSelected && !isCorrect) cls += " incorrect";
                      else if (isSelected) cls += " selected";

                      return (
                        <button key={i} onClick={() => selectAnswer(currentIdx, opt)} className={cls + " w-full text-left flex items-start gap-3"}>
                          <span className="w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
                            style={{
                              borderColor: showAnswer && isCorrect ? "#6b8f5e" : showAnswer && isSelected && !isCorrect ? "#9b3b3b" : isSelected ? "var(--primary)" : "var(--border)",
                              color: showAnswer && isCorrect ? "#6b8f5e" : showAnswer && isSelected && !isCorrect ? "#9b3b3b" : isSelected ? "var(--primary)" : "var(--muted-foreground)",
                            }}
                          >
                            {showAnswer && isCorrect ? "✓" : showAnswer && isSelected && !isCorrect ? "✗" : letter}
                          </span>
                          <span className="text-sm text-foreground">{opt}</span>
                        </button>
                      );
                    })}
                  </div>

                  {showAnswer && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-5 p-4 bg-secondary rounded-lg">
                      <p className="text-sm font-medium text-foreground mb-1">Explanation</p>
                      <p className="text-sm text-muted-foreground">{current.explanation}</p>
                    </motion.div>
                  )}
                </CardContent>
              </Card>

              <div className="mt-4 flex gap-3">
                {!showAnswer ? (
                  <Button onClick={() => setShowAnswer(true)} disabled={userAnswers[currentIdx] === undefined} className="flex-1">
                    Check Answer
                  </Button>
                ) : (
                  <Button onClick={goNext} className="flex-1 gap-2">
                    {currentIdx < questions.length - 1 ? <>Next <ChevronRight className="h-4 w-4" /></> : "See Results"}
                  </Button>
                )}
              </div>
            </motion.div>
          )}

          {/* Results Phase */}
          {phase === "results" && (
            <motion.div key="results" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
              <div className="text-center mb-8">
                <div className={`w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center ${
                  percentage >= 70 ? "bg-green-100" : percentage >= 50 ? "bg-amber-100" : "bg-red-100"
                }`}>
                  <Trophy className={`h-10 w-10 ${percentage >= 70 ? "text-green-600" : percentage >= 50 ? "text-amber-600" : "text-red-600"}`} />
                </div>
                <h1 className="font-serif-vintage text-3xl font-bold text-foreground">Exam Complete!</h1>
                <p className="text-muted-foreground mt-2">
                  {selectedLessons.size} lesson{selectedLessons.size !== 1 ? "s" : ""} · {questions.length} questions
                </p>
              </div>

              <Card className="vintage-card mb-6">
                <CardContent className="p-6">
                  <div className="text-center mb-4">
                    <p className="text-5xl font-bold font-serif-vintage text-primary">{score}/{questions.length}</p>
                    <p className="text-2xl font-bold mt-1">{percentage}%</p>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <CheckCircle2 className="h-5 w-5 text-green-600 mx-auto mb-1" />
                      <p className="text-lg font-bold text-green-600">{score}</p>
                      <p className="text-xs text-muted-foreground">Correct</p>
                    </div>
                    <div className="text-center p-3 bg-red-50 rounded-lg">
                      <XCircle className="h-5 w-5 text-red-600 mx-auto mb-1" />
                      <p className="text-lg font-bold text-red-600">{questions.length - score}</p>
                      <p className="text-xs text-muted-foreground">Incorrect</p>
                    </div>
                    <div className="text-center p-3 bg-secondary rounded-lg">
                      <Clock className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
                      <p className="text-lg font-bold">{Math.round((Date.now() - startTime) / 1000)}s</p>
                      <p className="text-xs text-muted-foreground">Duration</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex gap-3 mb-6">
                <Button onClick={() => { setPhase("select"); setQuestions([]); setSelectedLessons(new Set()); }} variant="outline" className="flex-1 gap-2">
                  <RotateCcw className="h-4 w-4" />
                  New Exam
                </Button>
                <Button onClick={() => setPhase("review")} className="flex-1 gap-2">
                  Review Answers
                </Button>
              </div>
            </motion.div>
          )}

          {/* Review Phase */}
          {phase === "review" && (
            <motion.div key="review" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="flex items-center justify-between mb-6">
                <h1 className="font-serif-vintage text-xl font-bold text-foreground">Answer Review</h1>
                <Button variant="ghost" size="sm" onClick={() => setPhase("results")}>Back to Results</Button>
              </div>
              <div className="space-y-4">
                {questions.map((q, i) => {
                  const userAns = userAnswers[i];
                  const isCorrect = userAns === q.correctAnswer;
                  return (
                    <Card key={i} className="vintage-card">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${isCorrect ? "bg-green-100" : "bg-red-100"}`}>
                            {isCorrect ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-red-600" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-[10px] text-muted-foreground">{q.relatedTopic}</span>
                            <p className="text-sm font-medium text-foreground mb-2">{i + 1}. {q.questionText}</p>
                            <div className="text-xs space-y-1">
                              {!isCorrect && userAns && <p className="text-red-600">Your answer: {userAns}</p>}
                              <p className="text-green-700">Correct: {q.correctAnswer}</p>
                              <p className="text-muted-foreground mt-2">{q.explanation}</p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
              <div className="mt-6">
                <Button onClick={() => { setPhase("select"); setQuestions([]); setSelectedLessons(new Set()); }} variant="outline" className="w-full gap-2">
                  <RotateCcw className="h-4 w-4" />
                  Take Another Exam
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppLayout>
  );
}
