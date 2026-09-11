import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Circle,
  Clock,
  GraduationCap,
  BookOpen,
  Target,
  MessageCircle,
  CreditCard,
  HelpCircle,
  FileText,
  Sparkles,
} from "lucide-react";
import { Link, useParams } from "react-router";
import { motion, AnimatePresence } from "framer-motion";
import type { Id } from "@/convex/_generated/dataModel";

function ChecklistItem({
  item,
  onToggle,
}: {
  item: { _id: Id<"studyChecklist">; text: string; status: string };
  onToggle: (id: Id<"studyChecklist">, status: string) => void;
}) {
  const statusIcon =
    item.status === "completed" ? (
      <CheckCircle2 className="h-4 w-4 text-green-600" />
    ) : item.status === "studying" ? (
      <Clock className="h-4 w-4 text-amber-600" />
    ) : (
      <Circle className="h-4 w-4 text-muted-foreground" />
    );

  const cycleStatus = () => {
    if (item.status === "not_started") onToggle(item._id, "studying");
    else if (item.status === "studying") onToggle(item._id, "completed");
    else onToggle(item._id, "not_started");
  };

  return (
    <li
      onClick={cycleStatus}
      className={`cursor-pointer transition-all hover:bg-secondary/50 rounded-lg px-3 py-2.5 -mx-3 ${
        item.status === "completed" ? "line-through opacity-60" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        {statusIcon}
        <span className="text-sm text-foreground">{item.text}</span>
      </div>
    </li>
  );
}

export default function Study() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const allLessons = useQuery(api.lessons.listUserLessons);
  const updateChecklistStatus = useMutation(api.studyChecklist.updateStatus);

  const [expandedBook, setExpandedBook] = useState<string | null>(null);

  // If viewing a specific lesson
  const lessonContext = useQuery(
    api.lessons.getLessonContext,
    lessonId ? { lessonId: lessonId as Id<"lessons"> } : "skip"
  );
  const checklist = useQuery(
    api.studyChecklist.list,
    lessonId ? { lessonId: lessonId as Id<"lessons"> } : "skip"
  );
  const lessonInfo = useQuery(
    api.lessonInfo.list,
    lessonId ? { lessonId: lessonId as Id<"lessons"> } : "skip"
  );
  const lessonFlashcards = useQuery(
    api.flashcards.list,
    lessonId ? { lessonId: lessonId as Id<"lessons"> } : "skip"
  );
  const lessonQuizzes = useQuery(
    api.quizzes.listByLesson,
    lessonId ? { lessonId: lessonId as Id<"lessons"> } : "skip"
  );

  const handleChecklistToggle = async (itemId: Id<"studyChecklist">, status: string) => {
    await updateChecklistStatus({
      itemId,
      status: status as "not_started" | "studying" | "completed",
    });
  };

  const mustKnow = lessonInfo?.filter((i) => i.level === "must_know") ?? [];
  const important = lessonInfo?.filter((i) => i.level === "important") ?? [];
  const extra = lessonInfo?.filter((i) => i.level === "extra") ?? [];

  const completedCount = checklist?.filter((c) => c.status === "completed").length ?? 0;
  const totalCount = checklist?.length ?? 0;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Lesson list view
  if (!lessonId) {
    return (
      <AppLayout>
        <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
          <div className="mb-6">
            <h1 className="font-serif-vintage text-2xl sm:text-3xl font-bold text-foreground">
              Study
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Select a lesson to start studying
            </p>
          </div>

          {!allLessons || allLessons.length === 0 ? (
            <Card className="vintage-card">
              <CardContent className="p-12 text-center">
                <GraduationCap className="h-16 w-16 mx-auto mb-4 text-muted-foreground/20" />
                <h3 className="font-serif-vintage text-lg font-bold text-foreground mb-2">
                  No Lessons Yet
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Upload your textbook and organize pages to create lessons
                </p>
                <Link to="/books">
                  <Button className="gap-2">
                    <BookOpen className="h-4 w-4" />
                    Go to Books
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {allLessons.map((lesson) => (
                <Link key={lesson._id} to={`/study/${lesson._id}`}>
                  <div className="vintage-card p-4 flex items-center justify-between hover:border-primary/30 transition-all cursor-pointer group">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <BookOpen className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-medium text-sm text-foreground group-hover:text-primary transition-colors">
                          {lesson.title}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {lesson.summary?.slice(0, 60) || "No summary available"}
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </AppLayout>
    );
  }

  // Lesson detail view
  if (!lessonContext) {
    return (
      <AppLayout>
        <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
          <div className="animate-pulse text-muted-foreground">Loading lesson...</div>
        </div>
      </AppLayout>
    );
  }

  const { lesson, chapter, unit, book } = lessonContext;

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4 flex-wrap">
          <Link to="/study" className="hover:text-primary transition-colors">Study</Link>
          <ChevronRight className="h-3 w-3" />
          {book && <span>{book.title}</span>}
          {unit && (
            <>
              <ChevronRight className="h-3 w-3" />
              <span>{unit.title}</span>
            </>
          )}
          {chapter && (
            <>
              <ChevronRight className="h-3 w-3" />
              <span>{chapter.title}</span>
            </>
          )}
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground font-medium">{lesson?.title}</span>
        </div>

        {/* Lesson Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <h1 className="font-serif-vintage text-2xl sm:text-3xl font-bold text-foreground">
            {lesson?.title}
          </h1>
          {lesson?.summary && (
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed max-w-2xl">
              {lesson.summary}
            </p>
          )}
          <div className="flex items-center gap-2 mt-3 text-xs text-muted-foreground">
            <span>Based on your uploaded textbook pages</span>
            <Sparkles className="h-3 w-3 text-accent" />
          </div>
        </motion.div>

        {/* Progress */}
        {totalCount > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium text-foreground">Study Progress</span>
              <span className="text-sm font-bold text-primary">{completedCount}/{totalCount} ({progressPercent}%)</span>
            </div>
            <div className="progress-vintage h-2.5">
              <motion.div
                className="progress-vintage-fill"
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.6 }}
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Quick Actions */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Link to={`/quizzes?lessonId=${lessonId}`}>
                <Button variant="outline" className="w-full h-auto py-3 flex-col gap-1.5">
                  <HelpCircle className="h-5 w-5" />
                  <span className="text-xs font-medium">Start Quiz</span>
                </Button>
              </Link>
              <Link to={`/flashcards/${lessonId}`}>
                <Button variant="outline" className="w-full h-auto py-3 flex-col gap-1.5">
                  <CreditCard className="h-5 w-5" />
                  <span className="text-xs font-medium">Flashcards</span>
                </Button>
              </Link>
              <Link to={`/chat/${lessonId}`}>
                <Button variant="outline" className="w-full h-auto py-3 flex-col gap-1.5">
                  <MessageCircle className="h-5 w-5" />
                  <span className="text-xs font-medium">Ask AI</span>
                </Button>
              </Link>
              <Link to={`/review/${lessonId}`}>
                <Button variant="outline" className="w-full h-auto py-3 flex-col gap-1.5">
                  <FileText className="h-5 w-5" />
                  <span className="text-xs font-medium">Quick Review</span>
                </Button>
              </Link>
            </div>

            {/* Must Know */}
            {mustKnow.length > 0 && (
              <Card className="vintage-card">
                <CardHeader className="pb-2">
                  <CardTitle className="font-serif-vintage text-base flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    Must Know
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {mustKnow.map((item) => (
                      <div key={item._id} className="p-3 bg-red-50/50 rounded-lg border border-red-100">
                        <p className="text-sm text-foreground">{item.content}</p>
                        {item.sourcePageId && (
                          <p className="text-[10px] text-muted-foreground mt-1">
                            Source: Page uploaded from your textbook
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Important */}
            {important.length > 0 && (
              <Card className="vintage-card">
                <CardHeader className="pb-2">
                  <CardTitle className="font-serif-vintage text-base flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-amber-500" />
                    Important
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {important.map((item) => (
                      <div key={item._id} className="p-3 bg-amber-50/50 rounded-lg border border-amber-100">
                        <p className="text-sm text-foreground">{item.content}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Extra Detail */}
            {extra.length > 0 && (
              <Card className="vintage-card">
                <CardHeader className="pb-2">
                  <CardTitle className="font-serif-vintage text-base flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-blue-400" />
                    Extra Detail
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {extra.map((item) => (
                      <div key={item._id} className="p-3 bg-blue-50/30 rounded-lg border border-blue-100">
                        <p className="text-sm text-foreground">{item.content}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Key Terms (from lesson) */}
            {lesson?.keyTerms && (
              <Card className="vintage-card">
                <CardHeader className="pb-2">
                  <CardTitle className="font-serif-vintage text-base">Key Terms</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {(() => {
                      try {
                        const terms = JSON.parse(lesson.keyTerms) as { term: string; definition: string }[];
                        return terms.map((t, i) => (
                          <div key={i} className="p-3 bg-secondary rounded-lg">
                            <p className="font-bold text-sm text-foreground">{t.term}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{t.definition}</p>
                          </div>
                        ));
                      } catch {
                        return <p className="text-sm text-muted-foreground">{lesson.keyTerms}</p>;
                      }
                    })()}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Formulas (Physics) */}
            {lesson?.formulas && (
              <Card className="vintage-card">
                <CardHeader className="pb-2">
                  <CardTitle className="font-serif-vintage text-base">Formula Sheet</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {(() => {
                      try {
                        const formulas = JSON.parse(lesson.formulas) as {
                          formula: string;
                          variables: string;
                          units: string;
                          whenUsed: string;
                          example: string;
                        }[];
                        return formulas.map((f, i) => (
                          <div key={i} className="p-4 bg-secondary rounded-lg border border-border">
                            <p className="font-mono text-lg font-bold text-primary mb-2">{f.formula}</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                              <div>
                                <span className="font-medium text-muted-foreground">Variables:</span>{" "}
                                <span className="text-foreground">{f.variables}</span>
                              </div>
                              <div>
                                <span className="font-medium text-muted-foreground">Units:</span>{" "}
                                <span className="text-foreground">{f.units}</span>
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                              <span className="font-medium">When to use:</span> {f.whenUsed}
                            </p>
                            <p className="text-xs text-foreground mt-1">
                              <span className="font-medium">Example:</span> {f.example}
                            </p>
                          </div>
                        ));
                      } catch {
                        return <p className="text-sm text-muted-foreground">{lesson.formulas}</p>;
                      }
                    })()}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar: Checklist */}
          <div className="space-y-4">
            <Card className="vintage-card">
              <CardHeader className="pb-2">
                <CardTitle className="font-serif-vintage text-base">You Need To Know</CardTitle>
              </CardHeader>
              <CardContent>
                {checklist && checklist.length > 0 ? (
                  <ul className="space-y-1">
                    {checklist.map((item) => (
                      <ChecklistItem
                        key={item._id}
                        item={item}
                        onToggle={handleChecklistToggle}
                      />
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Checklist will be generated when pages are analyzed
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Quiz history for this lesson */}
            {lessonQuizzes && lessonQuizzes.length > 0 && (
              <Card className="vintage-card">
                <CardHeader className="pb-2">
                  <CardTitle className="font-serif-vintage text-base">Quiz History</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {lessonQuizzes.slice(0, 5).map((q) => (
                      <div key={q._id} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground capitalize">{q.mode}</span>
                        <span className={`font-bold ${q.percentage >= 70 ? "text-green-600" : "text-red-600"}`}>
                          {q.percentage}%
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
