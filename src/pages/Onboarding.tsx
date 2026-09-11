import { useState } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Check, ChevronRight, GraduationCap } from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { GRADES, SUBJECTS, CURRICULA } from "@/types/study";
import type { Grade, Subject, Curriculum } from "@/types/study";
import logo from "@/assets/logo.svg";

const steps = ["grade", "subject", "curriculum", "confirm"] as const;

export default function Onboarding() {
  const navigate = useNavigate();
  const updateProfile = useMutation(api.userProfiles.updateProfile);
  const { user } = useAuth();
  const [step, setStep] = useState<number>(0);
  const [grade, setGrade] = useState<Grade>(9);
  const [subject, setSubject] = useState<Subject>("physics");
  const [curriculum, setCurriculum] = useState<Curriculum>("general");
  const [loading, setLoading] = useState(false);

  const handleComplete = async () => {
    setLoading(true);
    try {
      await updateProfile({
        grade,
        subject,
        curriculum,
        language: "english",
        onboardingCompleted: true,
        name: user?.name || undefined,
      });
      navigate("/dashboard");
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const currentStep = steps[step];
  const progress = ((step + 1) / steps.length) * 100;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background vintage-texture px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <img src={logo} alt="StudyAI" className="h-12 w-12 mx-auto rounded-xl mb-4" />
          <h1 className="font-serif-vintage text-2xl font-bold text-foreground">
            Welcome to StudyAI UAE
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Let's set up your study profile
          </p>
        </div>

        {/* Progress bar */}
        <div className="mb-6">
          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: "linear-gradient(90deg, #8b6f47, #c9a96e)" }}
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.4, ease: "easeOut" }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            {steps.map((s, i) => (
              <span key={s} className={i <= step ? "text-primary font-medium" : ""}>
                {s === "grade" ? "Grade" : s === "subject" ? "Subject" : s === "curriculum" ? "Stream" : "Confirm"}
              </span>
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <Card className="vintage-card">
              <CardContent className="p-6">
                {currentStep === "grade" && (
                  <div>
                    <h2 className="font-serif-vintage text-lg font-bold mb-1">Select Your Grade</h2>
                    <p className="text-sm text-muted-foreground mb-5">
                      Choose the grade you're currently studying
                    </p>
                    <div className="grid grid-cols-3 gap-3">
                      {GRADES.map((g) => (
                        <button
                          key={g}
                          onClick={() => setGrade(g)}
                          className={`p-4 rounded-xl border-2 text-center transition-all ${
                            grade === g
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border hover:border-primary/40"
                          }`}
                        >
                          <GraduationCap className="h-6 w-6 mx-auto mb-1" />
                          <span className="font-bold text-sm">Grade {g}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {currentStep === "subject" && (
                  <div>
                    <h2 className="font-serif-vintage text-lg font-bold mb-1">Select Your Subject</h2>
                    <p className="text-sm text-muted-foreground mb-5">
                      What subject would you like to study first?
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {SUBJECTS.map((s) => (
                        <button
                          key={s.value}
                          onClick={() => setSubject(s.value)}
                          className={`p-5 rounded-xl border-2 text-center transition-all ${
                            subject === s.value
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border hover:border-primary/40"
                          }`}
                        >
                          <span className="text-2xl mb-2 block">
                            {s.value === "physics" ? "⚛️" : "🧬"}
                          </span>
                          <span className="font-bold text-sm">{s.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {currentStep === "curriculum" && (
                  <div>
                    <h2 className="font-serif-vintage text-lg font-bold mb-1">Select Your Stream</h2>
                    <p className="text-sm text-muted-foreground mb-5">
                      Which curriculum track are you following?
                    </p>
                    <div className="grid grid-cols-1 gap-3">
                      {CURRICULA.map((c) => (
                        <button
                          key={c.value}
                          onClick={() => setCurriculum(c.value)}
                          className={`p-4 rounded-xl border-2 text-left transition-all ${
                            curriculum === c.value
                              ? "border-primary bg-primary/10"
                              : "border-border hover:border-primary/40"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-bold text-sm">{c.label}</span>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {c.value === "general"
                                  ? "Standard UAE curriculum"
                                  : "Advanced UAE curriculum track"}
                              </p>
                            </div>
                            {curriculum === c.value && (
                              <Check className="h-5 w-5 text-primary shrink-0" />
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {currentStep === "confirm" && (
                  <div>
                    <h2 className="font-serif-vintage text-lg font-bold mb-1">Confirm Your Profile</h2>
                    <p className="text-sm text-muted-foreground mb-5">
                      Review your selections
                    </p>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                        <span className="text-sm text-muted-foreground">Grade</span>
                        <span className="font-bold text-sm">Grade {grade}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                        <span className="text-sm text-muted-foreground">Subject</span>
                        <span className="font-bold text-sm capitalize">{subject}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                        <span className="text-sm text-muted-foreground">Stream</span>
                        <span className="font-bold text-sm">
                          {curriculum === "general" ? "UAE General" : "UAE Advanced"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                        <span className="text-sm text-muted-foreground">Language</span>
                        <span className="font-bold text-sm">English</span>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </AnimatePresence>

        {/* Buttons */}
        <div className="mt-6 flex gap-3">
          {step > 0 && (
            <Button
              variant="outline"
              onClick={() => setStep(step - 1)}
              className="flex-1"
            >
              Back
            </Button>
          )}
          {step < steps.length - 1 ? (
            <Button
              onClick={() => setStep(step + 1)}
              className="flex-1 gap-2"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              onClick={handleComplete}
              disabled={loading}
              className="flex-1 gap-2"
            >
              {loading ? "Setting up..." : "Get Started"}
              {!loading && <ChevronRight className="h-4 w-4" />}
            </Button>
          )}
        </div>

        {/* Skip */}
        {step < steps.length - 1 && (
          <button
            onClick={() => navigate("/dashboard")}
            className="w-full mt-3 text-center text-xs text-muted-foreground hover:text-foreground transition-colors py-2"
          >
            Skip for now
          </button>
        )}
      </div>
    </div>
  );
}
