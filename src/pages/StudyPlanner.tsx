import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  BookOpen,
  ChevronRight,
} from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import type { Id } from "@/convex/_generated/dataModel";
import type { Doc } from "@/convex/_generated/dataModel";

export default function StudyPlanner() {
  const { user } = useAuth();
  const allLessons = useQuery(api.lessons.listUserLessons);
  const activePlan = useQuery(api.studyPlans.getActivePlan);
  const createPlan = useMutation(api.studyPlans.create);
  const markSessionComplete = useMutation(api.studyPlans.markSessionComplete);
  const topicPerformance = useQuery(api.quizzes.getTopicPerformance);

  const [examDate, setExamDate] = useState("");
  const [studyDays, setStudyDays] = useState(5);
  const [minutesPerDay, setMinutesPerDay] = useState(30);
  const [creating, setCreating] = useState(false);

  const handleCreatePlan = async () => {
    if (!examDate || !allLessons) return;
    setCreating(true);
    try {
      const examTimestamp = new Date(examDate).getTime();
      const now = Date.now();
      const daysUntilExam = Math.max(1, Math.ceil((examTimestamp - now) / (1000 * 60 * 60 * 24)));
      const totalDays = Math.min(studyDays, daysUntilExam);

      // Create sessions
      const sessions: {
        date: number;
        lessonId?: Id<"lessons">;
        subject: string;
        topic: string;
        durationMinutes: number;
        order: number;
      }[] = [];

      // Sort lessons: weak topics first, then by priority
      const weakIds = new Set((topicPerformance ?? []).filter((t) => t.percentage < 60).map((t) => t.lessonId));
      const sortedLessons = [...allLessons].sort((a, b) => {
        if (weakIds.has(a._id) && !weakIds.has(b._id)) return -1;
        if (!weakIds.has(a._id) && weakIds.has(b._id)) return 1;
        return 0;
      });

      for (let day = 0; day < totalDays; day++) {
        const date = new Date(now + (day + 1) * 24 * 60 * 60 * 1000);
        date.setHours(9, 0, 0, 0);
        const lessonIdx = day % sortedLessons.length;
        const lesson = sortedLessons[lessonIdx];
        if (lesson) {
          sessions.push({
            date: date.getTime(),
            lessonId: lesson._id,
            subject: user?.subject || "physics",
            topic: lesson.title,
            durationMinutes: minutesPerDay,
            order: day,
          });
        }
      }

      await createPlan({
        title: `Exam Revision - ${new Date(examTimestamp).toLocaleDateString()}`,
        examDate: examTimestamp,
        sessions,
      });
    } catch (e) {
      console.error(e);
    } finally {
      setCreating(false);
    }
  };

  const handleToggleSession = async (sessionId: Id<"studyPlanSessions">) => {
    await markSessionComplete({ sessionId });
  };

  // Exam countdown
  const examTimestamp = activePlan?.plan?.examDate;
  const daysLeft = examTimestamp
    ? Math.max(0, Math.ceil((examTimestamp - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
        <h1 className="font-serif-vintage text-2xl sm:text-3xl font-bold text-foreground mb-2">
          Study Planner
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          Plan your revision schedule for upcoming exams
        </p>

        {/* Exam countdown */}
        {activePlan && daysLeft > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`aged-paper vintage-card p-6 mb-6 text-center ${
              daysLeft <= 3 ? "border-red-200" : ""
            }`}
          >
            {daysLeft <= 3 && <AlertTriangle className="h-6 w-6 text-red-500 mx-auto mb-2" />}
            <p className="text-sm text-muted-foreground mb-1">Days Until Exam</p>
            <p className="font-serif-vintage text-5xl font-bold text-foreground">{daysLeft}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {activePlan.plan.title}
            </p>
          </motion.div>
        )}

        {/* Create new plan */}
        {!activePlan && (
          <Card className="vintage-card mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="font-serif-vintage text-base">
                Create a Study Plan
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm">Exam Date</Label>
                <Input
                  type="date"
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-sm">Study Days per Week</Label>
                <Input
                  type="number"
                  value={studyDays}
                  onChange={(e) => setStudyDays(Number(e.target.value))}
                  min={1}
                  max={7}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-sm">Minutes per Day</Label>
                <Input
                  type="number"
                  value={minutesPerDay}
                  onChange={(e) => setMinutesPerDay(Number(e.target.value))}
                  min={10}
                  max={180}
                  className="mt-1"
                />
              </div>
              <Button onClick={handleCreatePlan} disabled={!examDate || creating} className="w-full gap-2">
                <Calendar className="h-4 w-4" />
                {creating ? "Creating Plan..." : "Generate Study Plan"}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Active plan schedule */}
        {activePlan && (
          <div className="space-y-3">
            <h2 className="font-serif-vintage font-bold text-lg text-foreground">
              Your Schedule
            </h2>
            {activePlan.sessions.map((session) => {
              const sessionDate = new Date(session.date);
              const isPast = sessionDate.getTime() < Date.now();
              return (
                <div
                  key={session._id}
                  className={`vintage-card p-4 flex items-center gap-3 transition-all ${
                    session.completed ? "opacity-60" : ""
                  } ${isPast && !session.completed ? "border-amber-200" : ""}`}
                >
                  <button
                    onClick={() => handleToggleSession(session._id)}
                    className="shrink-0"
                  >
                    <CheckCircle2
                      className={`h-5 w-5 transition-colors ${
                        session.completed ? "text-green-600" : "text-muted-foreground"
                      }`}
                    />
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${session.completed ? "line-through" : ""}`}>
                      {session.topic}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {sessionDate.toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}{" "}
                      · {session.durationMinutes} min · {session.subject}
                    </p>
                  </div>
                  {session.completed && (
                    <span className="text-xs text-green-600 font-medium">Done</span>
                  )}
                </div>
              );
            })}

            <Button
              variant="outline"
              className="w-full mt-4"
              onClick={() => {
                // Could add exam mode link here
              }}
            >
              Start Exam Mode Practice
            </Button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
