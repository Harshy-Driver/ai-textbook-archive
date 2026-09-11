import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { User, BookOpen, Brain, Clock, Award, ChevronRight, Settings } from "lucide-react";
import { Link } from "react-router";

export default function Profile() {
  const { user } = useAuth();
  const books = useQuery(api.books.listByUser);
  const userLessons = useQuery(api.lessons.listUserLessons);
  const allProgress = useQuery(api.progress.getUserProgress);
  const quizAttempts = useQuery(api.quizzes.listAttempts);

  const totalStudyMinutes = (allProgress ?? []).reduce((s, p) => s + p.studyMinutes, 0);
  const avgScore = quizAttempts && quizAttempts.length > 0
    ? Math.round(quizAttempts.reduce((s, a) => s + a.percentage, 0) / quizAttempts.length)
    : 0;

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto">
        {/* Profile Header */}
        <div className="aged-paper vintage-card p-6 mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="font-serif-vintage text-xl font-bold text-foreground">
                {user?.name || "Student"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {user?.email || "Guest user"}
              </p>
              <div className="flex items-center gap-2 mt-1">
                {user?.grade && (
                  <span className="text-xs px-2 py-0.5 bg-secondary rounded-full">
                    Grade {user.grade}
                  </span>
                )}
                {user?.subject && (
                  <span className="text-xs px-2 py-0.5 bg-secondary rounded-full capitalize">
                    {user.subject}
                  </span>
                )}
                {user?.curriculum && (
                  <span className="text-xs px-2 py-0.5 bg-secondary rounded-full capitalize">
                    {user.curriculum}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="vintage-card p-4 text-center">
            <BookOpen className="h-5 w-5 text-primary mx-auto mb-1" />
            <p className="text-xl font-bold font-serif-vintage text-foreground">{books?.length ?? 0}</p>
            <p className="text-xs text-muted-foreground">Books</p>
          </div>
          <div className="vintage-card p-4 text-center">
            <Award className="h-5 w-5 text-primary mx-auto mb-1" />
            <p className="text-xl font-bold font-serif-vintage text-foreground">{userLessons?.length ?? 0}</p>
            <p className="text-xs text-muted-foreground">Lessons</p>
          </div>
          <div className="vintage-card p-4 text-center">
            <Brain className="h-5 w-5 text-primary mx-auto mb-1" />
            <p className="text-xl font-bold font-serif-vintage text-foreground">{quizAttempts?.length ?? 0}</p>
            <p className="text-xs text-muted-foreground">Quizzes</p>
          </div>
          <div className="vintage-card p-4 text-center">
            <Clock className="h-5 w-5 text-primary mx-auto mb-1" />
            <p className="text-xl font-bold font-serif-vintage text-foreground">{totalStudyMinutes}m</p>
            <p className="text-xs text-muted-foreground">Study Time</p>
          </div>
        </div>

        {/* Average Score */}
        <Card className="vintage-card mb-6">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Overall Quiz Average</p>
              <p className="text-xs text-muted-foreground">Across all quiz attempts</p>
            </div>
            <div className={`text-2xl font-bold font-serif-vintage ${
              avgScore >= 70 ? "text-green-600" : avgScore >= 50 ? "text-amber-600" : "text-red-600"
            }`}>
              {avgScore}%
            </div>
          </CardContent>
        </Card>

        {/* Quick Links */}
        <div className="space-y-2">
          <Link to="/settings">
            <div className="vintage-card p-4 flex items-center justify-between cursor-pointer hover:border-primary/30 transition-all">
              <div className="flex items-center gap-3">
                <Settings className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-sm font-medium text-foreground">Settings</p>
                  <p className="text-xs text-muted-foreground">Profile, grade, subject, preferences</p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </Link>
        </div>
      </div>
    </AppLayout>
  );
}
