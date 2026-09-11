import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText, AlertTriangle, Lightbulb, BookOpen } from "lucide-react";
import { useParams, Link } from "react-router";
import type { Id } from "@/convex/_generated/dataModel";

export default function QuickReview() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const lessonContext = useQuery(
    api.lessons.getLessonContext,
    lessonId ? { lessonId: lessonId as Id<"lessons"> } : "skip"
  );
  const lessonInfo = useQuery(
    api.lessonInfo.list,
    lessonId ? { lessonId: lessonId as Id<"lessons"> } : "skip"
  );

  if (!lessonContext) {
    return (
      <AppLayout>
        <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      </AppLayout>
    );
  }

  const { lesson } = lessonContext;
  const mustKnow = lessonInfo?.filter((i) => i.level === "must_know") ?? [];
  const important = lessonInfo?.filter((i) => i.level === "important") ?? [];

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link to={lessonId ? `/study/${lessonId}` : "/study"}>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="font-serif-vintage text-xl font-bold text-foreground">
              Quick Review
            </h1>
            <p className="text-xs text-muted-foreground">{lesson?.title}</p>
          </div>
        </div>

        {/* Review Sheet */}
        <Card className="vintage-card aged-paper mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="font-serif-vintage text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Lesson Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground leading-relaxed">
              {lesson?.summary || "No summary available for this lesson. Upload textbook pages to generate a summary."}
            </p>
          </CardContent>
        </Card>

        {/* Key Concepts */}
        {mustKnow.length > 0 && (
          <Card className="vintage-card mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="font-serif-vintage text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                Key Concepts (Must Know)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {mustKnow.map((item) => (
                  <li key={item._id} className="flex items-start gap-2 text-sm">
                    <span className="text-red-500 mt-1">•</span>
                    <span className="text-foreground">{item.content}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Key Terms */}
        {lesson?.keyTerms && (
          <Card className="vintage-card mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="font-serif-vintage text-base flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                Key Terms
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(() => {
                  try {
                    const terms = JSON.parse(lesson.keyTerms) as { term: string; definition: string }[];
                    return terms.map((t, i) => (
                      <div key={i} className="p-3 bg-secondary rounded-lg">
                        <p className="font-bold text-sm">{t.term}</p>
                        <p className="text-xs text-muted-foreground">{t.definition}</p>
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

        {/* Formulas */}
        {lesson?.formulas && (
          <Card className="vintage-card mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="font-serif-vintage text-base flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-accent" />
                Formulas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                try {
                  const formulas = JSON.parse(lesson.formulas) as {
                    formula: string;
                    variables: string;
                  }[];
                  return formulas.map((f, i) => (
                    <div key={i} className="p-3 bg-secondary rounded-lg mb-2 last:mb-0">
                      <p className="font-mono font-bold text-primary">{f.formula}</p>
                      <p className="text-xs text-muted-foreground mt-1">{f.variables}</p>
                    </div>
                  ));
                } catch {
                  return <p className="text-sm text-muted-foreground">{lesson.formulas}</p>;
                }
              })()}
            </CardContent>
          </Card>
        )}

        {/* Important Items */}
        {important.length > 0 && (
          <Card className="vintage-card mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="font-serif-vintage text-base">
                Important to Remember
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {important.map((item) => (
                  <li key={item._id} className="flex items-start gap-2 text-sm">
                    <span className="text-amber-500 mt-1">•</span>
                    <span className="text-foreground">{item.content}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Common Mistakes placeholder */}
        <Card className="vintage-card mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="font-serif-vintage text-base">
              Common Mistakes to Avoid
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Upload textbook pages for this lesson to generate a common mistakes section.
            </p>
          </CardContent>
        </Card>

        {/* Back button */}
        <Link to={lessonId ? `/study/${lessonId}` : "/study"}>
          <Button variant="outline" className="w-full gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Lesson
          </Button>
        </Link>
      </div>
    </AppLayout>
  );
}
