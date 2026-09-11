import { motion } from "framer-motion";
import { Link } from "react-router";
import { Button } from "@/components/ui/button";
import {
  BookOpen,
  Camera,
  Brain,
  BarChart3,
  GraduationCap,
  HelpCircle,
  CreditCard,
  Calendar,
  ChevronRight,
  Sparkles,
  Shield,
  Zap,
} from "lucide-react";
import logo from "@/assets/logo.svg";

const features = [
  {
    icon: Camera,
    title: "Upload Textbooks",
    description: "Take photos or upload pages from your Physics and Biology textbooks. Our AI reads and understands every page.",
  },
  {
    icon: Brain,
    title: "AI Study System",
    description: "Get organized study plans, checklists, and summaries generated directly from your uploaded textbook pages.",
  },
  {
    icon: HelpCircle,
    title: "Smart Quizzes",
    description: "Auto-generated quizzes based on your lessons. Adaptive difficulty that targets your weak areas.",
  },
  {
    icon: CreditCard,
    title: "Flashcards",
    description: "Generate flashcards from your textbook content. Flip, review, and track what you know.",
  },
  {
    icon: Calendar,
    title: "Study Planner",
    description: "Enter your exam date and get a personalized revision schedule that prioritizes what you need most.",
  },
  {
    icon: BarChart3,
    title: "Track Progress",
    description: "See your growth over time with detailed statistics on quizzes, study time, and topic mastery.",
  },
];

const grades = [
  { grade: 9, subjects: "Physics & Biology" },
  { grade: 10, subjects: "Physics & Biology" },
  { grade: 11, subjects: "Physics & Biology" },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background vintage-texture">
      {/* Hero */}
      <header className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-secondary/50 to-transparent" />
        <div className="relative max-w-5xl mx-auto px-4 pt-6 pb-20 sm:pt-10 sm:pb-28">
          <nav className="flex items-center justify-between mb-16 sm:mb-24">
            <div className="flex items-center gap-2.5">
              <img src={logo} alt="StudyAI" className="h-9 w-9 rounded-xl" />
              <span className="font-serif-vintage text-xl font-bold text-foreground">
                StudyAI UAE
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/auth">
                <Button variant="ghost" size="sm" className="text-sm">
                  Sign In
                </Button>
              </Link>
              <Link to="/auth">
                <Button size="sm" className="text-sm gap-1.5">
                  Get Started
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          </nav>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-2xl mx-auto"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 text-accent-foreground border border-accent/20 text-xs font-medium mb-6">
              <Sparkles className="h-3.5 w-3.5 text-accent" />
              AI-Powered Textbook Study System
            </div>

            <h1 className="font-serif-vintage text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground tracking-tight leading-[1.1]">
              Your Personal{" "}
              <span className="bg-gradient-to-r from-[#8b6f47] to-[#c9a96e] bg-clip-text text-transparent">
                Textbook
              </span>{" "}
              Study Companion
            </h1>

            <p className="mt-5 text-base sm:text-lg text-muted-foreground leading-relaxed max-w-xl mx-auto">
              Upload your UAE Grade 9–11 Physics and Biology textbooks. 
              StudyAI reads your pages, creates study plans, generates quizzes, 
              and helps you master every lesson.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link to="/auth">
                <Button size="lg" className="gap-2 text-base px-7">
                  Start Studying Free
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="#features">
                <Button variant="outline" size="lg" className="text-base px-7">
                  See Features
                </Button>
              </Link>
            </div>

            {/* Trust badges */}
            <div className="mt-8 flex items-center justify-center gap-6 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5" />
                Private & Secure
              </div>
              <div className="flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5" />
                AI-Powered Analysis
              </div>
              <div className="flex items-center gap-1.5">
                <GraduationCap className="h-3.5 w-3.5" />
                UAE Curriculum
              </div>
            </div>
          </motion.div>
        </div>
      </header>

      {/* Grade Cards */}
      <section className="max-w-5xl mx-auto px-4 -mt-4 mb-20">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {grades.map((g, i) => (
            <motion.div
              key={g.grade}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="aged-paper vintage-card p-5 text-center cursor-default"
            >
              <div className="font-serif-vintage text-3xl font-bold text-primary mb-1">
                Grade {g.grade}
              </div>
              <div className="text-sm text-muted-foreground">{g.subjects}</div>
              <div className="ornament-divider mt-3 text-[10px]">✦</div>
              <div className="text-xs text-muted-foreground mt-1">General & Advanced Streams</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-5xl mx-auto px-4 mb-20">
        <div className="text-center mb-12">
          <h2 className="font-serif-vintage text-2xl sm:text-3xl font-bold text-foreground">
            Everything You Need to Ace Your Exams
          </h2>
          <p className="mt-3 text-muted-foreground max-w-lg mx-auto">
            From uploading your textbook to acing your final exam — every tool a UAE student needs.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.35, delay: i * 0.05 }}
              className="aged-paper vintage-card p-6"
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <f.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-serif-vintage font-bold text-foreground mb-2">
                {f.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {f.description}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="max-w-5xl mx-auto px-4 mb-20">
        <div className="text-center mb-12">
          <h2 className="font-serif-vintage text-2xl sm:text-3xl font-bold text-foreground">
            How It Works
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
          {[
            { step: "1", title: "Upload Pages", desc: "Photograph or upload pages from your textbook" },
            { step: "2", title: "AI Reads It", desc: "Our AI identifies lessons, topics, and key content" },
            { step: "3", title: "Study Smart", desc: "Get organized checklists, summaries, and quizzes" },
            { step: "4", title: "Ace Your Exam", desc: "Track progress and master every topic" },
          ].map((s, i) => (
            <motion.div
              key={s.step}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: i * 0.1 }}
              className="text-center"
            >
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <span className="font-serif-vintage font-bold text-lg text-primary">{s.step}</span>
              </div>
              <h3 className="font-serif-vintage font-bold text-sm text-foreground mb-1">{s.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-5xl mx-auto px-4 mb-16">
        <div className="aged-paper vintage-card p-8 sm:p-12 text-center">
          <h2 className="font-serif-vintage text-2xl sm:text-3xl font-bold text-foreground mb-3">
            Ready to Transform Your Study Habits?
          </h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Join UAE students using AI to study smarter. Upload your first textbook in under a minute.
          </p>
          <Link to="/auth">
            <Button size="lg" className="gap-2 text-base px-8">
              Get Started — It's Free
              <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <img src={logo} alt="StudyAI" className="h-5 w-5 rounded" />
            <span className="font-serif-vintage text-sm font-bold">StudyAI UAE</span>
          </div>
          <p className="text-xs text-muted-foreground">
            © 2026 StudyAI UAE. Built for UAE students.
          </p>
        </div>
      </footer>
    </div>
  );
}
