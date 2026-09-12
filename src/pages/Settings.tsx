import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, GraduationCap, User, BookOpen, Globe, Bell, Gauge } from "lucide-react";
import { GRADES, SUBJECTS, CURRICULA } from "@/types/study";
import type { Grade, Subject, Curriculum } from "@/types/study";

const INTENSITIES = [
  { value: "light", label: "Light", desc: "Only the most essential information" },
  { value: "balanced", label: "Balanced", desc: "Important concepts plus useful supporting info" },
  { value: "exam_focus", label: "Exam Focus", desc: "Detailed understanding, calculations, definitions, processes" },
] as const;

export default function Settings() {
  const { user } = useAuth();
  const updateProfile = useMutation(api.userProfiles.updateProfile);
  const [name, setName] = useState(user?.name || "");
  const [grade, setGrade] = useState<Grade>((user?.grade as Grade) || 9);
  const [subject, setSubject] = useState<Subject>((user?.subject as Subject) || "physics");
  const [curriculum, setCurriculum] = useState<Curriculum>((user?.curriculum as Curriculum) || "general");
  const [intensity, setIntensity] = useState<"light" | "balanced" | "exam_focus">(
    (user?.studyIntensity as "light" | "balanced" | "exam_focus") || "balanced",
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await updateProfile({
        name: name.trim() || undefined,
        grade,
        subject,
        curriculum,
        language: "english",
        studyIntensity: intensity,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto">
        <h1 className="font-serif-vintage text-2xl sm:text-3xl font-bold text-foreground mb-6">
          Settings
        </h1>

        <div className="space-y-6">
          {/* Profile */}
          <Card className="vintage-card">
            <CardHeader className="pb-3">
              <CardTitle className="font-serif-vintage text-base flex items-center gap-2">
                <User className="h-4 w-4" />
                Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm">Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-sm">Email</Label>
                <Input
                  value={user?.email || ""}
                  disabled
                  className="mt-1 opacity-60"
                />
              </div>
            </CardContent>
          </Card>

          {/* Academic */}
          <Card className="vintage-card">
            <CardHeader className="pb-3">
              <CardTitle className="font-serif-vintage text-base flex items-center gap-2">
                <GraduationCap className="h-4 w-4" />
                Academic Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Grade */}
              <div>
                <Label className="text-sm font-medium mb-2 block">Grade</Label>
                <div className="grid grid-cols-3 gap-2">
                  {GRADES.map((g) => (
                    <button
                      key={g}
                      onClick={() => setGrade(g)}
                      className={`p-3 rounded-lg border-2 text-center text-sm font-medium transition-all ${
                        grade === g
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:border-primary/30"
                      }`}
                    >
                      Grade {g}
                      {grade === g && <Check className="h-3 w-3 inline ml-1" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Subject */}
              <div>
                <Label className="text-sm font-medium mb-2 block">Subject</Label>
                <div className="grid grid-cols-2 gap-2">
                  {SUBJECTS.map((s) => (
                    <button
                      key={s.value}
                      onClick={() => setSubject(s.value)}
                      className={`p-3 rounded-lg border-2 text-center text-sm font-medium transition-all ${
                        subject === s.value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:border-primary/30"
                      }`}
                    >
                      {s.value === "physics" ? "⚛️" : "🧬"} {s.label}
                      {subject === s.value && <Check className="h-3 w-3 inline ml-1" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Curriculum */}
              <div>
                <Label className="text-sm font-medium mb-2 block">Stream</Label>
                <div className="grid grid-cols-2 gap-2">
                  {CURRICULA.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => setCurriculum(c.value)}
                      className={`p-3 rounded-lg border-2 text-center text-sm font-medium transition-all ${
                        curriculum === c.value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:border-primary/30"
                      }`}
                    >
                      {c.label}
                      {curriculum === c.value && <Check className="h-3 w-3 inline ml-1" />}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Study intensity */}
          <Card className="vintage-card">
            <CardHeader className="pb-3">
              <CardTitle className="font-serif-vintage text-base flex items-center gap-2">
                <Gauge className="h-4 w-4" />
                Study Intensity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-muted-foreground mb-2">
                Controls how much the AI highlights on your textbook pages. Nothing is ever
                claimed to be "guaranteed on the exam".
              </p>
              {INTENSITIES.map((i) => (
                <button
                  key={i.value}
                  onClick={() => setIntensity(i.value)}
                  className={`w-full p-3 rounded-lg border-2 text-left transition-all ${
                    intensity === i.value
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/30"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{i.label}</p>
                    {intensity === i.value && <Check className="h-3 w-3 text-primary" />}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{i.desc}</p>
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Preferences */}
          <Card className="vintage-card">
            <CardHeader className="pb-3">
              <CardTitle className="font-serif-vintage text-base flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Preferences
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-3 bg-secondary rounded-lg">
                <div className="flex items-center gap-3">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Language</p>
                    <p className="text-xs text-muted-foreground">English</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <Button onClick={handleSave} disabled={saving} className="w-full" size="lg">
            {saving ? "Saving..." : saved ? "✓ Saved!" : "Save Changes"}
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
