import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ChevronRight,
  ChevronLeft,
  RotateCcw,
  Target,
  CheckCircle2,
  XCircle,
  Trophy,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import { Link, useSearchParams } from "react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import type { Id } from "@/convex/_generated/dataModel";
import type { QuizDifficulty, QuestionType } from "@/types/study";

// Sample quiz questions that would normally come from AI
const generateSampleQuestions = (
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
}[] => {
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
      explanation: `This option correctly identifies the core concept taught in ${lessonTitle}. The other options either describe unrelated content or advanced topics not covered in this lesson.`,
      relatedTopic: lessonTitle,
    },
    {
      questionText: `In the context of ${lessonTitle}, which statement is correct?`,
      questionType: "mcq",
      options: [
        "The concept applies only under specific conditions",
        "The principle has no practical applications",
        "Understanding this topic is essential for advanced study",
        "This concept was disproven by modern research",
      ],
      correctAnswer: "Understanding this topic is essential for advanced study",
      explanation: `${lessonTitle} is a foundational concept that builds the groundwork for more advanced topics. Mastering it is crucial for future learning.`,
      relatedTopic: lessonTitle,
    },
    {
      questionText: `True or False: The concepts in ${lessonTitle} are independent of other topics in the textbook.`,
      questionType: "true_false",
      options: ["True", "False"],
      correctAnswer: "False",
      explanation: "Most textbook topics are interconnected. Understanding ${lessonTitle} helps build context for related concepts.",
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
      explanation: "While definitions, applications, and formulas are central to the lesson, unrelated historical events are not a key aspect of this topic.",
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
      explanation: "The primary purpose is to build understanding of the principles taught in this lesson and see how they apply in real-world contexts.",
      relatedTopic: lessonTitle,
    },
    {
      questionText: `True or False: ${lessonTitle} is one of the most important topics in this chapter.`,
      questionType: "true_false",
      options: ["True", "False"],
      correctAnswer: "True",
      explanation: "This lesson is a key part of the chapter's content and understanding it is essential for mastering the subject material.",
      relatedTopic: lessonTitle,
    },
    {
      questionText: `When studying ${lessonTitle}, which approach is most effective?`,
      questionType: "mcq",
      options: [
        "Reviewing uploaded textbook pages and practicing problems",
        "Skipping the reading and guessing answers",
        "Only studying the day before the exam",
        "Focusing on topics from a different chapter",
      ],
      correctAnswer: "Reviewing uploaded textbook pages and practicing problems",
      explanation: "Active engagement with the textbook content through reading and practice is the most effective study method.",
      relatedTopic: lessonTitle,
    },
    {
      questionText: `Which best describes the relationship between concepts in ${lessonTitle}?`,
      questionType: "mcq",
      options: [
        "They build on each other in a logical sequence",
        "They are completely independent of each other",
        "They contradict each other",
        "They are only relevant in laboratory settings",
      ],
      correctAnswer: "They build on each other in a logical sequence",
      explanation: "Textbook concepts are typically organized in a logical progression, with each concept building on previous ones.",
      relatedTopic: lessonTitle,
    },
    {
      questionText: `What should you do if you don't understand a concept in ${lessonTitle}?`,
      questionType: "reasoning",
      options: [
        "Re-read the relevant textbook pages and ask the AI tutor",
        "Ignore it and move on to the next topic",
        "Look up answers from unrelated sources",
        "Skip studying this lesson entirely",
      ],
      correctAnswer: "Re-read the relevant textbook pages and ask the AI tutor",
      explanation: "The best approach is to revisit the source material and seek clarification through the AI tutor or study tools.",
      relatedTopic: lessonTitle,
    },
    {
      questionText: `True or False: Complete understanding of ${lessonTitle} requires both memorization and application.`,
      questionType: "true_false",
      options: ["True", "False"],
      correctAnswer: "True",
      explanation: "Effective learning of scientific concepts requires both understanding definitions and knowing how to apply them.",
      relatedTopic: lessonTitle,
    },
  ];

  // Filter by type if needed
  let pool = [...base];
  if (type === "true_false") {
    pool = pool.filter((q) => q.questionType === "true_false");
    // Pad with more if needed
    while (pool.length < count) {
      pool.push(...base.filter((q) => q.questionType === "true_false"));
    }
  } else if (type === "mcq") {
    pool = pool.filter((q) => q.questionType === "mcq");
  }

  for (let i = 0; i < Math.min(count, pool.length); i++) {
    questions.push(pool[i]);
  }

  // Shuffle
  for (let i = questions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [questions[i], questions[j]] = [questions[j], questions[i]];
  }

  return questions.slice(0, count);
};

export default function Quiz() {
  const [searchParams] = useSearchParams();
  const lessonIdParam = searchParams.get("lessonId");
  const modeParam = searchParams.get("mode") as "lesson" | "exam" | "page" | "weak_topics" | null;

  const allLessons = useQuery(api.lessons.listUserLessons);
  const topicPerformance = useQuery(api.quizzes.getTopicPerformance);
  const recordAttempt = useMutation(api.quizzes.recordAttempt);
  const recordQuizStat = useMutation(api.progress.recordQuiz);

  // Quiz configuration state
  const [phase, setPhase] = useState<"config" | "taking" | "results" | "review">("config");
  const [selectedLessonId, setSelectedLessonId] = useState<string>(lessonIdParam || "");
  const [questionCount, setQuestionCount] = useState(10);
  const [difficulty, setDifficulty] = useState<QuizDifficulty>("mixed");
  const [questionTypes, setQuestionTypes] = useState<QuestionType>("mixed");

  // Quiz state
  const [questions, setQuestions] = useState<Awaited<ReturnType<typeof generateSampleQuestions>>>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
  const [showAnswer, setShowAnswer] = useState(false);
  const [startTime, setStartTime] = useState(0);

  const startQuiz = useCallback(() => {
    const lessonTitle = allLessons?.find((l) => l._id === selectedLessonId)?.title || "this lesson";
    const qs = generateSampleQuestions(lessonTitle, questionCount, difficulty, questionTypes);
    setQuestions(qs);
    setCurrentIdx(0);
    setUserAnswers({});
    setShowAnswer(false);
    setStartTime(Date.now());
    setPhase("taking");
  }, [selectedLessonId, questionCount, difficulty, questionTypes, allLessons]);

  const selectAnswer = (questionIdx: number, answer: string) => {
    if (showAnswer) return;
    setUserAnswers((prev) => ({ ...prev, [questionIdx]: answer }));
  };

  const goNext = () => {
    if (currentIdx < questions.length - 1) {
      setShowAnswer(false);
      setCurrentIdx(currentIdx + 1);
    } else {
      finishQuiz();
    }
  };

  const finishQuiz = async () => {
    let correct = 0;
    questions.forEach((q, i) => {
      if (userAnswers[i] === q.correctAnswer) correct++;
    });
    const percentage = Math.round((correct / questions.length) * 100);
    const duration = Math.round((Date.now() - startTime) / 1000);

    if (selectedLessonId) {
      try {
        await recordAttempt({
          lessonId: selectedLessonId as Id<"lessons">,
          mode: modeParam || "lesson",
          questionCount: questions.length,
          difficulty,
          questionTypes,
          score: correct,
          totalQuestions: questions.length,
          percentage,
          answers: JSON.stringify(userAnswers),
          duration,
        });
        await recordQuizStat({
          quizCorrect: correct,
          quizTotal: questions.length,
        });
      } catch (e) {
        console.error("Failed to record quiz:", e);
      }
    }

    setPhase("results");
  };

  const current = questions[currentIdx];
  const score = questions.filter((q, i) => userAnswers[i] === q.correctAnswer).length;
  const percentage = Math.round((score / questions.length) * 100);

  // Find weak topics
  const weakTopics = topicPerformance?.filter((t) => t.percentage < 60) ?? [];

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
        <AnimatePresence mode="wait">
          {/* Configuration Phase */}
          {phase === "config" && (
            <motion.div
              key="config"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="mb-6">
                <h1 className="font-serif-vintage text-2xl sm:text-3xl font-bold text-foreground">
                  Quiz
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Test your knowledge with AI-generated questions
                </p>
              </div>

              <Card className="vintage-card mb-6">
                <CardContent className="p-6 space-y-5">
                  {/* Select Lesson */}
                  <div>
                    <label className="text-sm font-medium text-foreground block mb-2">
                      Select Lesson
                    </label>
                    <select
                      value={selectedLessonId}
                      onChange={(e) => setSelectedLessonId(e.target.value)}
                      className="w-full p-2.5 rounded-lg border border-border bg-card text-sm text-foreground"
                    >
                      <option value="">Choose a lesson...</option>
                      {allLessons?.map((l) => (
                        <option key={l._id} value={l._id}>
                          {l.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Question Count */}
                  <div>
                    <label className="text-sm font-medium text-foreground block mb-2">
                      Number of Questions
                    </label>
                    <div className="flex gap-2">
                      {[5, 10, 15, 20].map((n) => (
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

                  {/* Difficulty */}
                  <div>
                    <label className="text-sm font-medium text-foreground block mb-2">
                      Difficulty
                    </label>
                    <div className="flex gap-2">
                      {(["easy", "medium", "hard", "mixed"] as const).map((d) => (
                        <button
                          key={d}
                          onClick={() => setDifficulty(d)}
                          className={`flex-1 py-2 rounded-lg border-2 text-sm font-medium capitalize transition-all ${
                            difficulty === d
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border hover:border-primary/30"
                          }`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Question Types */}
                  <div>
                    <label className="text-sm font-medium text-foreground block mb-2">
                      Question Types
                    </label>
                    <div className="flex gap-2 flex-wrap">
                      {(["mixed", "mcq", "true_false", "calculation", "reasoning"] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => setQuestionTypes(t)}
                          className={`px-4 py-2 rounded-lg border-2 text-sm font-medium capitalize transition-all ${
                            questionTypes === t
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border hover:border-primary/30"
                          }`}
                        >
                          {t === "mcq" ? "MCQ" : t === "true_false" ? "True/False" : t}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Start Button */}
                  <Button
                    onClick={startQuiz}
                    disabled={!selectedLessonId}
                    className="w-full gap-2"
                    size="lg"
                  >
                    <Sparkles className="h-4 w-4" />
                    Start Quiz
                  </Button>
                </CardContent>
              </Card>

              {/* Weak Topics */}
              {weakTopics.length > 0 && (
                <Card className="vintage-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="font-serif-vintage text-base flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-accent" />
                      You Should Review
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {weakTopics.map((topic) => (
                        <div key={topic.lessonId} className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                          <span className="text-sm font-medium">Topic {topic.lessonId}</span>
                          <span className="text-sm font-bold text-red-600">{topic.percentage}%</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </motion.div>
          )}

          {/* Taking Phase */}
          {phase === "taking" && current && (
            <motion.div
              key={`question-${currentIdx}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              {/* Progress */}
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-muted-foreground">
                  Question {currentIdx + 1} of {questions.length}
                </span>
                <span className="text-sm font-medium text-primary">
                  {Math.round(((currentIdx + 1) / questions.length) * 100)}%
                </span>
              </div>
              <div className="progress-vintage h-1.5 mb-6">
                <div
                  className="progress-vintage-fill transition-all duration-300"
                  style={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }}
                />
              </div>

              <Card className="vintage-card">
                <CardContent className="p-6">
                  <div className="mb-2">
                    <span className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground px-2 py-1 bg-secondary rounded">
                      {current.questionType === "mcq"
                        ? "Multiple Choice"
                        : current.questionType === "true_false"
                        ? "True / False"
                        : current.questionType}
                    </span>
                  </div>
                  <h2 className="font-serif-vintage text-lg font-bold text-foreground mt-3 mb-5">
                    {current.questionText}
                  </h2>

                  <div className="space-y-2.5">
                    {current.options.map((opt, i) => {
                      const letter = String.fromCharCode(65 + i);
                      const isSelected = userAnswers[currentIdx] === opt;
                      const isCorrect = opt === current.correctAnswer;
                      const showResults = showAnswer;

                      let className = "quiz-option";
                      if (showResults && isCorrect) className += " correct";
                      else if (showResults && isSelected && !isCorrect) className += " incorrect";
                      else if (isSelected) className += " selected";

                      return (
                        <button
                          key={i}
                          onClick={() => selectAnswer(currentIdx, opt)}
                          className={className + " w-full text-left flex items-start gap-3"}
                        >
                          <span className="w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
                            style={{
                              borderColor: showResults && isCorrect ? "#6b8f5e" : showResults && isSelected && !isCorrect ? "#9b3b3b" : isSelected ? "var(--primary)" : "var(--border)",
                              color: showResults && isCorrect ? "#6b8f5e" : showResults && isSelected && !isCorrect ? "#9b3b3b" : isSelected ? "var(--primary)" : "var(--muted-foreground)",
                            }}
                          >
                            {showResults && isCorrect ? "✓" : showResults && isSelected && !isCorrect ? "✗" : letter}
                          </span>
                          <span className="text-sm text-foreground">{opt}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Explanation */}
                  {showAnswer && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="mt-5 p-4 bg-secondary rounded-lg"
                    >
                      <p className="text-sm font-medium text-foreground mb-1">Explanation</p>
                      <p className="text-sm text-muted-foreground">{current.explanation}</p>
                      {current.relatedTopic && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Related topic: {current.relatedTopic}
                        </p>
                      )}
                    </motion.div>
                  )}
                </CardContent>
              </Card>

              {/* Navigation */}
              <div className="mt-4 flex gap-3">
                {!showAnswer ? (
                  <Button
                    onClick={() => setShowAnswer(true)}
                    disabled={userAnswers[currentIdx] === undefined}
                    className="flex-1"
                  >
                    Check Answer
                  </Button>
                ) : (
                  <Button onClick={goNext} className="flex-1 gap-2">
                    {currentIdx < questions.length - 1 ? (
                      <>Next <ChevronRight className="h-4 w-4" /></>
                    ) : (
                      "See Results"
                    )}
                  </Button>
                )}
              </div>
            </motion.div>
          )}

          {/* Results Phase */}
          {phase === "results" && (
            <motion.div
              key="results"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <div className="text-center mb-8">
                <div className={`w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center ${
                  percentage >= 70 ? "bg-green-100" : percentage >= 50 ? "bg-amber-100" : "bg-red-100"
                }`}>
                  <Trophy className={`h-10 w-10 ${
                    percentage >= 70 ? "text-green-600" : percentage >= 50 ? "text-amber-600" : "text-red-600"
                  }`} />
                </div>
                <h1 className="font-serif-vintage text-3xl font-bold text-foreground">
                  Quiz Complete!
                </h1>
                <p className="text-muted-foreground mt-2">
                  {percentage >= 70 ? "Great job! Keep it up!" : percentage >= 50 ? "Good effort! Review and try again." : "Keep studying! You'll improve."}
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
                      <Target className="h-5 w-5 text-muted-foreground mx-auto mb-1" />
                      <p className="text-lg font-bold">{Math.round((Date.now() - startTime) / 1000)}s</p>
                      <p className="text-xs text-muted-foreground">Duration</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex gap-3 mb-6">
                <Button onClick={() => { setPhase("config"); setQuestions([]); }} variant="outline" className="flex-1 gap-2">
                  <RotateCcw className="h-4 w-4" />
                  Retake Quiz
                </Button>
                <Button onClick={() => setPhase("review")} className="flex-1 gap-2">
                  Review Answers
                </Button>
              </div>

              {/* Weakest topics recommendation */}
              {percentage < 70 && (
                <Card className="vintage-card">
                  <CardContent className="p-4">
                    <p className="text-sm font-medium text-foreground mb-2">
                      You should review this lesson
                    </p>
                    <p className="text-xs text-muted-foreground mb-3">
                      Based on your quiz results, consider going back to the study page.
                    </p>
                    <Link to={selectedLessonId ? `/study/${selectedLessonId}` : "/study"}>
                      <Button variant="outline" size="sm" className="gap-2">
                        <ChevronRight className="h-3.5 w-3.5" />
                        Review Lesson
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              )}
            </motion.div>
          )}

          {/* Review Phase */}
          {phase === "review" && (
            <motion.div
              key="review"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="flex items-center justify-between mb-6">
                <h1 className="font-serif-vintage text-xl font-bold text-foreground">
                  Answer Review
                </h1>
                <Button variant="ghost" size="sm" onClick={() => setPhase("results")}>
                  Back to Results
                </Button>
              </div>

              <div className="space-y-4">
                {questions.map((q, i) => {
                  const userAns = userAnswers[i];
                  const isCorrect = userAns === q.correctAnswer;
                  return (
                    <Card key={i} className="vintage-card">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                            isCorrect ? "bg-green-100" : "bg-red-100"
                          }`}>
                            {isCorrect ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-600" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground mb-2">
                              {i + 1}. {q.questionText}
                            </p>
                            <div className="text-xs space-y-1">
                              {!isCorrect && userAns && (
                                <p className="text-red-600">Your answer: {userAns}</p>
                              )}
                              <p className="text-green-700">Correct answer: {q.correctAnswer}</p>
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
                <Button onClick={() => { setPhase("config"); setQuestions([]); }} variant="outline" className="w-full gap-2">
                  <RotateCcw className="h-4 w-4" />
                  Take Another Quiz
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppLayout>
  );
}
