import { useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AppLayout } from "@/components/AppLayout";
import {
  BookOpen,
  GraduationCap,
  TrendingUp,
  Target,
  Calendar,
  Brain,
  Upload,
  ChevronRight,
  AlertTriangle,
  ClipboardCheck,
} from "lucide-react";
import { Link, useNavigate } from "react-router";
import { motion } from "framer-motion"

function StatCard({ icon: Icon, label, value, color }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="aged-paper vintage-card p-4">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2.5 ${color}`}>
        <Icon className="h-4.5 w-4.5" />
      </div>
      <p className="text-2xl font-bold font-serif-vintage text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

function ProgressBar({ label, percent }: { label: string; percent: number }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="text-sm font-bold text-primary">{percent}%</span>
      </div>
      <div className="progress-vintage h-2.5">
        <motion.div
          className="progress-vintage-fill"
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && user && !user.onboardingCompleted) {
      navigate("/onboarding");
    }
  }, [user, isLoading, navigate]);

  const books = useQuery(api.books.listByUser);
  const userLessons = useQuery(api.lessons.listUserLessons);
  const allProgress = useQuery(api.progress.getUserProgress);
  const quizAttempts = useQuery(api.quizzes.listAttempts);
  const topicPerformance = useQuery(api.quizzes.getTopicPerformance);

  const totalLessons = userLessons?.length ?? 0;
  const completedLessons = allProgress?.filter((p) => p.progressPercent >= 100).length ?? 0;
  const remainingLessons = totalLessons - completedLessons;

  const totalQuizzes = quizAttempts?.length ?? 0;
  const avgScore = totalQuizzes > 0
    ? Math.round(
        (quizAttempts ?? []).reduce((sum, a) => sum + a.percentage, 0) / totalQuizzes
      )
    : 0;

  const worstTopic = topicPerformance?.[0];
  const totalStudyMinutes = (allProgress ?? []).reduce((s, p) => s + p.studyMinutes, 0);

  const physicsLessons = (userLessons ?? []).filter((l) => {
    // We'd need book data to determine subject; for now show aggregate
    return true;
  });

  // Calculate per-subject progress
  const physicsProgress = allProgress?.length
    ? Math.round(
        (allProgress.filter((p) => p.progressPercent >= 100).length /
          Math.max(totalLessons, 1)) *
          100
      )
    : 0;

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <h1 className="font-serif-vintage text-2xl sm:text-3xl font-bold text-foreground">
            Welcome{user?.name ? `, ${user.name}` : ""}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {user?.grade ? `Grade ${user.grade}` : "Set up your profile"} ·{" "}
            {user?.subject ? (user.subject === "physics" ? "Physics" : "Biology") : "Choose subject"} ·{" "}
            {user?.curriculum === "advanced" ? "Advanced" : "General"} Stream
          </p>
        </motion.div>

        {/* Quick Actions */}
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 mb-6">
          <Link to="/books">
            <Button variant="outline" className="w-full h-auto py-3 flex-col gap-1.5">
              <Upload className="h-5 w-5" />
              <span className="text-xs font-medium">Upload Book</span>
            </Button>
          </Link>
          <Link to="/study">
            <Button variant="outline" className="w-full h-auto py-3 flex-col gap-1.5">
              <GraduationCap className="h-5 w-5" />
              <span className="text-xs font-medium">Study Now</span>
            </Button>
          </Link>
          <Link to="/quizzes">
            <Button variant="outline" className="w-full h-auto py-3 flex-col gap-1.5">
              <Brain className="h-5 w-5" />
              <span className="text-xs font-medium">Take Quiz</span>
            </Button>
          </Link>
          <Link to="/planner">
            <Button variant="outline" className="w-full h-auto py-3 flex-col gap-1.5">
              <Calendar className="h-5 w-5" />
              <span className="text-xs font-medium">Study Plan</span>
            </Button>
          </Link>
          <Link to="/exam">
            <Button variant="outline" className="w-full h-auto py-3 flex-col gap-1.5">
              <ClipboardCheck className="h-5 w-5" />
              <span className="text-xs font-medium">Exam Mode</span>
            </Button>
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatCard icon={BookOpen} label="Books Uploaded" value={books?.length ?? 0} color="bg-primary/10 text-primary" />
          <StatCard icon={GraduationCap} label="Lessons Found" value={totalLessons} color="bg-primary/10 text-primary" />
          <StatCard icon={TrendingUp} label="Quizzes Taken" value={totalQuizzes} color="bg-primary/10 text-primary" />
          <StatCard icon={Target} label="Quiz Average" value={`${avgScore}%`} color="bg-primary/10 text-primary" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Study Progress */}
          <Card className="vintage-card">
            <CardHeader className="pb-3">
              <CardTitle className="font-serif-vintage text-lg">My Study Progress</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ProgressBar label="Overall Progress" percent={physicsProgress} />
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 bg-secondary rounded-lg">
                  <p className="text-muted-foreground text-xs">Completed</p>
                  <p className="font-bold text-foreground">{completedLessons} lessons</p>
                </div>
                <div className="p-3 bg-secondary rounded-lg">
                  <p className="text-muted-foreground text-xs">Remaining</p>
                  <p className="font-bold text-foreground">{remainingLessons} lessons</p>
                </div>
                <div className="p-3 bg-secondary rounded-lg">
                  <p className="text-muted-foreground text-xs">Study Time</p>
                  <p className="font-bold text-foreground">{totalStudyMinutes} min</p>
                </div>
                <div className="p-3 bg-secondary rounded-lg">
                  <p className="text-muted-foreground text-xs">Quiz Average</p>
                  <p className="font-bold text-foreground">{avgScore}%</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Weak Topics */}
          <Card className="vintage-card">
            <CardHeader className="pb-3">
              <CardTitle className="font-serif-vintage text-lg flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-accent" />
                My Weak Topics
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topicPerformance && topicPerformance.length > 0 ? (
                <div className="space-y-3">
                  {topicPerformance.slice(0, 5).map((topic, i) => (
                    <div key={topic.lessonId} className="flex items-center gap-3">
                      <span className="text-xs font-bold text-muted-foreground w-4">{i + 1}</span>
                      <div className="flex-1">
                        <ProgressBar label={`Topic ${topic.lessonId}`} percent={topic.percentage} />
                      </div>
                    </div>
                  ))}
                  <Link to="/quizzes?mode=weak_topics">
                    <Button variant="outline" size="sm" className="w-full mt-2 gap-1.5">
                      <Target className="h-3.5 w-3.5" />
                      Practice Weakest Topics
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  <Brain className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p>Take a quiz to see your weak topics</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="vintage-card">
            <CardHeader className="pb-3">
              <CardTitle className="font-serif-vintage text-lg">Recent Quizzes</CardTitle>
            </CardHeader>
            <CardContent>
              {quizAttempts && quizAttempts.length > 0 ? (
                <div className="space-y-2">
                  {quizAttempts.slice(0, 5).map((attempt) => (
                    <div key={attempt._id} className="flex items-center justify-between p-2.5 bg-secondary rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-foreground capitalize">
                          {attempt.mode} Quiz
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {attempt.questionCount} questions · {attempt.difficulty}
                        </p>
                      </div>
                      <div className={`text-sm font-bold ${
                        attempt.percentage >= 70 ? "text-green-700" : "text-red-700"
                      }`}>
                        {attempt.percentage}%
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-sm text-muted-foreground">
                  <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p>No quizzes yet. Start studying!</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Next Steps */}
          <Card className="vintage-card">
            <CardHeader className="pb-3">
              <CardTitle className="font-serif-vintage text-lg">Recommended</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {books && books.length === 0 ? (
                <Link to="/books">
                  <Button variant="outline" className="w-full justify-start gap-3 h-auto py-3">
                    <Upload className="h-5 w-5 text-primary shrink-0" />
                    <div className="text-left">
                      <p className="font-medium text-sm">Upload Your First Book</p>
                      <p className="text-xs text-muted-foreground">Photograph textbook pages to get started</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />
                  </Button>
                </Link>
              ) : (
                <>
                  <Link to="/study">
                    <Button variant="outline" className="w-full justify-start gap-3 h-auto py-3">
                      <GraduationCap className="h-5 w-5 text-primary shrink-0" />
                      <div className="text-left">
                        <p className="font-medium text-sm">Continue Studying</p>
                        <p className="text-xs text-muted-foreground">Pick up where you left off</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />
                    </Button>
                  </Link>
                  <Link to="/planner">
                    <Button variant="outline" className="w-full justify-start gap-3 h-auto py-3">
                      <Calendar className="h-5 w-5 text-primary shrink-0" />
                      <div className="text-left">
                        <p className="font-medium text-sm">I Have an Exam Soon</p>
                        <p className="text-xs text-muted-foreground">Get a personalized revision plan</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />
                    </Button>
                  </Link>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
