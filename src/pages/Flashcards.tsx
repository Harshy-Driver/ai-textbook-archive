import { useState, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  Shuffle,
  CheckCircle2,
  Bookmark,
  RotateCcw,
} from "lucide-react";
import { useParams } from "react-router";
import { motion, AnimatePresence } from "framer-motion";
import type { Id } from "@/convex/_generated/dataModel";

export default function Flashcards() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const flashcards = useQuery(
    api.flashcards.list,
    lessonId ? { lessonId: lessonId as Id<"lessons"> } : "skip"
  );
  const markKnown = useMutation(api.flashcards.markKnown);
  const markReview = useMutation(api.flashcards.markReview);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [filter, setFilter] = useState<"all" | "known" | "review">("all");

  const cards = flashcards ?? [];
  const filteredCards =
    filter === "all"
      ? cards
      : filter === "known"
      ? cards.filter((c) => c.known)
      : cards.filter((c) => c.forReview);

  const currentCard = filteredCards[currentIndex];
  const totalCards = filteredCards.length;

  const goNext = () => {
    if (currentIndex < totalCards - 1) {
      setFlipped(false);
      setCurrentIndex(currentIndex + 1);
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setFlipped(false);
      setCurrentIndex(currentIndex - 1);
    }
  };

  const shuffle = useCallback(() => {
    setCurrentIndex(0);
    setFlipped(false);
    // Shuffle is done by re-rendering with random order
  }, []);

  const handleMarkKnown = async () => {
    if (!currentCard) return;
    await markKnown({ cardId: currentCard._id, known: !currentCard.known });
  };

  const handleMarkReview = async () => {
    if (!currentCard) return;
    await markReview({ cardId: currentCard._id, forReview: !currentCard.forReview });
  };

  if (!lessonId) {
    return (
      <AppLayout>
        <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
          <h1 className="font-serif-vintage text-2xl font-bold text-foreground mb-4">Flashcards</h1>
          <p className="text-sm text-muted-foreground">Select a lesson to view flashcards</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto">
        <h1 className="font-serif-vintage text-2xl font-bold text-foreground mb-2">Flashcards</h1>
        <p className="text-sm text-muted-foreground mb-6">
          {totalCards} cards · {cards.filter((c) => c.known).length} known
        </p>

        {/* Filters */}
        <div className="flex gap-2 mb-6">
          {(["all", "known", "review"] as const).map((f) => (
            <button
              key={f}
              onClick={() => { setFilter(f); setCurrentIndex(0); setFlipped(false); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {f} ({f === "all" ? cards.length : cards.filter((c) => f === "known" ? c.known : c.forReview).length})
            </button>
          ))}
        </div>

        {totalCards > 0 ? (
          <>
            {/* Card */}
            <div
              onClick={() => setFlipped(!flipped)}
              className="cursor-pointer mb-6"
              style={{ perspective: "1000px" }}
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentIndex}
                  initial={{ rotateY: flipped ? -90 : 0, opacity: flipped ? 0 : 1 }}
                  animate={{ rotateY: 0, opacity: 1 }}
                  exit={{ rotateY: 90, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <Card className="vintage-card min-h-[250px] flex items-center justify-center">
                    <CardContent className="p-8 text-center">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-4">
                        {flipped ? "Answer" : "Question"}
                      </p>
                      <p className="font-serif-vintage text-xl font-bold text-foreground leading-relaxed">
                        {flipped ? currentCard.back : currentCard.front}
                      </p>
                      <p className="text-xs text-muted-foreground mt-6">
                        Tap to {flipped ? "see question" : "reveal answer"}
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between gap-2 mb-6">
              <Button
                variant="outline"
                onClick={goPrev}
                disabled={currentIndex === 0}
                size="icon"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium text-muted-foreground">
                {currentIndex + 1} / {totalCards}
              </span>
              <Button
                variant="outline"
                onClick={goNext}
                disabled={currentIndex >= totalCards - 1}
                size="icon"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Actions */}
            <div className="flex gap-2 justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={handleMarkKnown}
                className={`gap-1.5 ${currentCard?.known ? "bg-green-50 border-green-200 text-green-700" : ""}`}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {currentCard?.known ? "Known ✓" : "Mark Known"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleMarkReview}
                className={`gap-1.5 ${currentCard?.forReview ? "bg-amber-50 border-amber-200 text-amber-700" : ""}`}
              >
                <Bookmark className="h-3.5 w-3.5" />
                {currentCard?.forReview ? "Review ✓" : "Mark Review"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setCurrentIndex(0); setFlipped(false); }}
                className="gap-1.5"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
              </Button>
            </div>
          </>
        ) : (
          <Card className="vintage-card">
            <CardContent className="p-12 text-center">
              <CreditCardIcon className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
              <p className="font-serif-vintage text-lg font-bold text-foreground mb-2">
                No Flashcards Yet
              </p>
              <p className="text-sm text-muted-foreground">
                Flashcards are generated when you study a lesson with uploaded content
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}

// Simple icon placeholder
function CreditCardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <line x1="2" y1="10" x2="22" y2="10" />
    </svg>
  );
}
