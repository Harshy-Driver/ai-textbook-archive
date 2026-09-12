import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router";
import { useQuery, useMutation, useAction } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Highlighter, ZoomIn, ZoomOut, Maximize, Undo2, Redo2, Eraser, StickyNote,
  FileText, Sparkles, Loader2, AlertTriangle, Plus, Trash2, BookOpen,
  CreditCard, HelpCircle, ListChecks, GraduationCap, ScanLine, X, Check,
} from "lucide-react";
import {
  detectLineBoxes, snippetToBoxes, PRIORITY_COLORS, newHighlightId,
} from "@/lib/highlights";
import type { PageHighlight, HighlightPriority } from "@/lib/highlights";
import type { StudyFileSection } from "@/convex/studyAi";

type PanelData = {
  whatToKnow: string[];
  terms: { term: string; meaning: string }[];
  facts: string[];
  diagramInfo: string[];
  quickQuestions: string[];
};

type QuizQ = {
  questionText: string;
  type: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
};

export default function PageStudio() {
  const { bookId, pageId } = useParams<{ bookId: string; pageId: string }>();
  const navigate = useNavigate();
  const typedPageId = pageId as Id<"pages">;

  const page = useQuery(api.pages.listByBook, bookId ? { bookId: bookId as Id<"books"> } : "skip");
  const analysis = useQuery(api.studyAi.getPageAnalysis, { pageId: typedPageId });
  const pageStudy = useQuery(api.studyAi.getPageStudy, { pageId: typedPageId });
  const flashcards = useQuery(api.studyAi.listHighlightFlashcards, { pageId: typedPageId });

  const analyze = useAction(api.studyAi.analyzePage);
  const saveHighlights = useMutation(api.studyAi.saveHighlights);
  const resetAiHighlights = useMutation(api.studyAi.resetAiHighlights);
  const savePageStudy = useAction(api.studyAi.generatePageStudy);
  const summarize = useAction(api.studyAi.summarizeHighlights);
  const makeCards = useAction(api.studyAi.generateHighlightFlashcards);
  const makeQuiz = useAction(api.studyAi.generateHighlightQuiz);
  const genStudyFile = useAction(api.studyAi.generateStudyFile);
  const saveCards = useMutation(api.studyAi.saveHighlightFlashcards);

  const { user } = useAuth();
  const intensity = (user?.studyIntensity as "light" | "balanced" | "exam_focus") || "balanced";

  // ---- local state ----
  const [tab, setTab] = useState("highlighted");
  const [zoom, setZoom] = useState(1);
  const [fit, setFit] = useState(true);
  const [lineBoxes, setLineBoxes] = useState<ReturnType<typeof detectLineBoxes> extends Promise<infer T> ? T : never>([]);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [highlights, setHighlights] = useState<PageHighlight[]>([]);
  const [history, setHistory] = useState<PageHighlight[][]>([]);
  const [future, setFuture] = useState<PageHighlight[][]>([]);
  const [activeHl, setActiveHl] = useState<PageHighlight | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [priorityDraft, setPriorityDraft] = useState<HighlightPriority>("medium");
  const [addMode, setAddMode] = useState(false);
  const [panel, setPanel] = useState<PanelData | null>(null);
  const [panelLoading, setPanelLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [cardsOpen, setCardsOpen] = useState(false);
  const [cards, setCards] = useState<{ front: string; back: string }[]>([]);
  const [quizOpen, setQuizOpen] = useState(false);
  const [quizConfig, setQuizConfig] = useState<{ count: 5 | 10 | 15 | 20; difficulty: "easy" | "medium" | "hard" | "mixed" }>({ count: 5, difficulty: "mixed" });
  const [quiz, setQuiz] = useState<QuizQ[] | null>(null);
  const [quizAnswers, setQuizAnswers] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const thisPage = page?.find((p) => p._id === typedPageId);

  // Sync AI analysis into local editable state
  useEffect(() => {
    if (analysis) setHighlights(analysis.highlights ?? []);
  }, [analysis?._id, analysis?.updatedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (pageStudy) setPanel(pageStudy);
  }, [pageStudy?._id, pageStudy?.updatedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  // Detect text line boxes for highlight positioning once image is available
  useEffect(() => {
    let cancelled = false;
    if (thisPage?.imageUrl) {
      detectLineBoxes(thisPage.imageUrl).then((boxes) => {
        if (!cancelled) setLineBoxes(boxes);
      }).catch(() => {});
    }
    return () => { cancelled = true; };
  }, [thisPage?.imageUrl]);

  // ---- highlight editing with undo/redo ----
  const pushHistory = useCallback((prev: PageHighlight[]) => {
    setHistory((h) => [...h.slice(-24), prev]);
    setFuture([]);
  }, []);

  const commit = useCallback(
    (next: PageHighlight[]) => {
      setHighlights((prev) => {
        pushHistory(prev);
        return next;
      });
      saveHighlights({
        pageId: typedPageId,
        highlights: next.map((h) => ({
          text: h.text, priority: h.priority, kind: h.kind, note: h.note, source: h.source,
        })),
      }).catch((e) => console.error(e));
    },
    [typedPageId, saveHighlights, pushHistory],
  );

  const undo = () => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const prev = h[h.length - 1];
      setFuture((f) => [highlights, ...f].slice(0, 24));
      setHighlights(prev);
      saveHighlights({
        pageId: typedPageId,
        highlights: prev.map((hl) => ({ text: hl.text, priority: hl.priority, kind: hl.kind, note: hl.note, source: hl.source })),
      }).catch(() => {});
      return h.slice(0, -1);
    });
  };

  const redo = () => {
    setFuture((f) => {
      if (f.length === 0) return f;
      const next = f[0];
      setHistory((h) => [...h, highlights]);
      setHighlights(next);
      saveHighlights({
        pageId: typedPageId,
        highlights: next.map((hl) => ({ text: hl.text, priority: hl.priority, kind: hl.kind, note: hl.note, source: hl.source })),
      }).catch(() => {});
      return f.slice(1);
    });
  };

  const handleAnalyze = async () => {
    if (!thisPage) return;
    setAnalyzing(true);
    try {
      const result = await analyze({ pageId: typedPageId, imageUrl: thisPage.imageUrl, intensity });
      setHighlights(result.highlights ?? []);
      if (result.readability === "unreadable") {
        toast.error("This photo is too unclear to read. Please retake it with better light and hold the camera flat.", { duration: 6000 });
      } else if (result.readability === "partially_readable") {
        toast.warning("Some parts could not be read clearly. Consider re-uploading a sharper photo.", { duration: 5000 });
      } else {
        toast.success(`Page analysed — ${result.highlights.length} highlights found`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Analysis failed", { duration: 6000 });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleGenerateHighlightsFromText = () => handleAnalyze();

  // Manual highlight: drag horizontally over the page to select a text region
  const dragRef = useRef<HTMLDivElement>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragRect, setDragRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const relPos = (e: React.MouseEvent) => {
    const rect = dragRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    };
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if (!addMode) return;
    const p = relPos(e);
    setDragStart(p);
    setDragRect({ x: p.x, y: p.y, w: 0, h: 0 });
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragStart) return;
    const p = relPos(e);
    setDragRect({
      x: Math.min(dragStart.x, p.x),
      y: Math.min(dragStart.y, p.y),
      w: Math.abs(p.x - dragStart.x),
      h: Math.abs(p.y - dragStart.y),
    });
  };
  const onMouseUp = () => {
    if (!dragRect || dragRect.w < 0.01) {
      setDragStart(null);
      setDragRect(null);
      return;
    }
    // Try to snap to overlapping detected line boxes for a tidy highlight
    const overlapping = lineBoxes.filter(
      (lb) =>
        lb.y < dragRect.y + dragRect.h + 0.005 &&
        lb.y + lb.h > dragRect.y - 0.005 &&
        lb.x < dragRect.x + dragRect.w &&
        lb.x + lb.w > dragRect.x,
    );
    let box = dragRect;
    if (overlapping.length > 0) {
      const x0 = Math.min(...overlapping.map((b) => b.x));
      const x1 = Math.max(...overlapping.map((b) => b.x + b.w));
      const y0 = Math.min(...overlapping.map((b) => b.y));
      const y1 = Math.max(...overlapping.map((b) => b.y + b.h));
      box = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    }
    const manualBox: PageHighlight = {
      id: newHighlightId(),
      text: `Manual highlight (${(box.x * 100).toFixed(0)}%,${(box.y * 100).toFixed(0)}%)`,
      priority: "medium",
      kind: "custom",
      note: undefined,
      source: "user",
    };
    // Store drawn box directly on the highlight for exact placement
    manualBoxesRef.current.set(manualBox.id, box);
    commit([...highlights, manualBox]);
    setDragStart(null);
    setDragRect(null);
    setAddMode(false);
  };

  const manualBoxesRef = useRef<Map<string, { x: number; y: number; w: number; h: number }>>(new Map());

  const removeHighlight = (id: string) => {
    manualBoxesRef.current.delete(id);
    commit(highlights.filter((h) => h.id !== id));
    if (activeHl?.id === id) setActiveHl(null);
  };

  const cyclePriority = (hl: PageHighlight) => {
    const order: HighlightPriority[] = ["low", "medium", "high"];
    const next = order[(order.indexOf(hl.priority) + 1) % 3];
    commit(highlights.map((h) => (h.id === hl.id ? { ...h, priority: next } : h)));
    if (activeHl?.id === hl.id) setPriorityDraft(next);
  };

  const saveNote = () => {
    if (!activeHl) return;
    commit(
      highlights.map((h) =>
        h.id === activeHl.id ? { ...h, note: noteDraft.trim() || undefined, priority: priorityDraft } : h,
      ),
    );
    setActiveHl(null);
  };

  const handleResetAi = async () => {
    try {
      await resetAiHighlights({ pageId: typedPageId });
      setHighlights((prev) => prev.filter((h) => h.source === "user"));
      toast.success("AI highlights cleared — your own highlights remain");
    } catch {
      toast.error("Could not reset highlights");
    }
  };

  // ---- Study This Page ----
  const handleStudyPage = async () => {
    setPanelLoading(true);
    try {
      const p = await savePageStudy({ pageId: typedPageId });
      setPanel(p);
      toast.success("Study panel ready");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed", { duration: 6000 });
    } finally {
      setPanelLoading(false);
    }
  };

  // ---- Summarize selected highlights ----
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSummarize = async () => {
    const sel = highlights.filter((h) => selectedIds.has(h.id));
    if (sel.length === 0) {
      toast.error("Select one or more highlights first (click the checkbox on a highlight card)");
      return;
    }
    setBusy("summary");
    try {
      const res = await summarize({
        pageId: typedPageId,
        selected: sel.map((h) => ({ text: h.text, note: h.note })),
      });
      setSummary(res.summary);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed", { duration: 6000 });
    } finally {
      setBusy(null);
    }
  };

  // ---- Flashcards ----
  const handleFlashcards = async () => {
    setBusy("cards");
    try {
      const res = await makeCards({
        pageId: typedPageId,
        highlights: highlights.map((h) => ({ text: h.text, note: h.note })),
      });
      setCards(res.cards);
      setCardsOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed", { duration: 6000 });
    } finally {
      setBusy(null);
    }
  };

  const handleSaveCards = async () => {
    try {
      await saveCards({ pageId: typedPageId, cards });
      toast.success(`${cards.length} flashcards saved — open them from Flashcards`);
      setCardsOpen(false);
    } catch {
      toast.error("Could not save flashcards");
    }
  };

  // ---- Quiz ----
  const handleQuiz = async () => {
    setBusy("quiz");
    try {
      const res = await makeQuiz({
        pageId: typedPageId,
        highlights: highlights.map((h) => ({ text: h.text, note: h.note })),
        count: quizConfig.count,
        difficulty: quizConfig.difficulty,
      });
      setQuiz(res.questions);
      setQuizAnswers({});
      setQuizOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed", { duration: 6000 });
    } finally {
      setBusy(null);
    }
  };

  const quizScore = quiz
    ? quiz.reduce((acc, q, i) => acc + (quizAnswers[i] === q.correctAnswer ? 1 : 0), 0)
    : 0;

  // ---- Study file ----
  const handleStudyFile = async () => {
    if (!bookId) return;
    setBusy("file");
    try {
      const res = await genStudyFile({ pageIds: [typedPageId], scope: "page" });
      toast.success("Study file created");
      navigate(`/study-files/${res.studyFileId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed", { duration: 6000 });
    } finally {
      setBusy(null);
    }
  };

  const highlightOverlay = useMemo(() => {
    if (tab !== "highlighted" || !analysis?.fullText) return null;
    const boxesByHl: Record<string, { x: number; y: number; w: number; h: number }[]> = {};
    for (const hl of highlights) {
      if (hl.source === "user" && manualBoxesRef.current.has(hl.id)) {
        boxesByHl[hl.id] = [manualBoxesRef.current.get(hl.id)!];
      } else {
        boxesByHl[hl.id] = snippetToBoxes(hl.text, analysis.fullText, lineBoxes);
      }
    }
    return boxesByHl;
  }, [tab, analysis?.fullText, highlights, lineBoxes]);

  const unreadable = analysis?.readability === "unreadable";

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
          <div>
            <Link
              to={bookId ? `/books/${bookId}/pages` : "/books"}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors mb-1"
            >
              <X className="h-3.5 w-3.5 rotate-45" /> Back to pages
            </Link>
            <h1 className="font-serif-vintage text-xl sm:text-2xl font-bold text-foreground">
              Page Studio
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {thisPage ? `Page ${thisPage.order + 1} of your book` : "Loading…"}
              {analysis?.pageNumber ? ` · Textbook page ${analysis.pageNumber}` : ""}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={handleAnalyze} disabled={analyzing || !thisPage} className="gap-2">
              {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Highlighter className="h-4 w-4" />}
              {analyzing ? "Reading page…" : "Highlight Important Things"}
            </Button>
            <Button onClick={handleStudyFile} disabled={busy === "file" || !analysis} variant="outline" className="gap-2">
              {busy === "file" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              Create Study File
            </Button>
          </div>
        </div>

        {unreadable && (
          <div className="mb-4 p-3 rounded-lg border border-amber-300 bg-amber-50 text-amber-900 text-sm flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">This photo needs a clearer retake.</p>
              <p className="text-xs mt-0.5">{analysis?.readabilityNote || "The text could not be read reliably."} Upload a sharper photo of this page for accurate results.</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* Viewer */}
          <div className="lg:col-span-3">
            <Card className="vintage-card overflow-hidden">
              <div className="px-3 pt-3 border-b border-border flex items-center justify-between flex-wrap gap-2">
                <Tabs value={tab} onValueChange={setTab}>
                  <TabsList>
                    <TabsTrigger value="original">Original</TabsTrigger>
                    <TabsTrigger value="highlighted">Highlighted</TabsTrigger>
                  </TabsList>
                </Tabs>
                <div className="flex items-center gap-1 pb-1.5">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setFit(false); setZoom((z) => Math.max(0.5, +(z - 0.2).toFixed(2))); }} title="Zoom out">
                    <ZoomOut className="h-3.5 w-3.5" />
                  </Button>
                  <span className="text-xs text-muted-foreground w-10 text-center">{Math.round(zoom * 100)}%</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setFit(false); setZoom((z) => Math.min(3, +(z + 0.2).toFixed(2))); }} title="Zoom in">
                    <ZoomIn className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => { setFit(true); setZoom(1); }} title="Fit to screen">
                    <Maximize className="h-3 w-3 mr-1" /> Fit
                  </Button>
                </div>
              </div>

              <TabsContent value="original" className="mt-0">
                <div className="max-h-[70vh] overflow-auto bg-secondary/40 p-3">
                  {thisPage?.imageUrl ? (
                    <img
                      src={thisPage.imageUrl}
                      alt="Textbook page"
                      onLoad={() => setImgLoaded(true)}
                      className="mx-auto rounded shadow-md"
                      style={fit ? { maxWidth: "100%", height: "auto" } : { width: `${zoom * 100}%` }}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground p-8 text-center">No image</p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="highlighted" className="mt-0">
                <div className="px-3 pt-2 flex items-center gap-3 flex-wrap text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded" style={{ background: PRIORITY_COLORS.high.fill, border: `1px solid ${PRIORITY_COLORS.high.border}` }} /> High</span>
                  <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded" style={{ background: PRIORITY_COLORS.medium.fill, border: `1px solid ${PRIORITY_COLORS.medium.border}` }} /> Medium</span>
                  <span className="flex items-center gap-1"><span className="inline-block w-3 h-3 rounded" style={{ background: PRIORITY_COLORS.low.fill, border: `1px solid ${PRIORITY_COLORS.low.border}` }} /> Low</span>
                  <button onClick={() => setAddMode((a) => !a)} className={`ml-auto px-2 py-0.5 rounded border text-[11px] transition-colors ${addMode ? "bg-primary text-white border-primary" : "border-border hover:border-primary/40"}`}>
                    <Plus className="h-3 w-3 inline mr-1" /> Add highlight
                  </button>
                </div>
                <div
                  ref={dragRef}
                  onMouseDown={onMouseDown}
                  onMouseMove={onMouseMove}
                  onMouseUp={onMouseUp}
                  className={`relative max-h-[70vh] overflow-auto bg-secondary/40 p-3 ${addMode ? "cursor-crosshair" : ""}`}
                >
                  {thisPage?.imageUrl ? (
                    <div className="relative mx-auto" style={fit ? { maxWidth: "100%" } : { width: `${zoom * 100}%` }}>
                      <img src={thisPage.imageUrl} alt="Textbook page" className="w-full rounded shadow-md" />
                      {/* translucent overlay boxes — original text stays visible */}
                      <div className="absolute inset-0">
                        {(highlightOverlay ? Object.entries(highlightOverlay) : []).flatMap(([hid, boxes]) => {
                          const hl = highlights.find((h) => h.id === hid);
                          if (!hl) return null;
                          const c = PRIORITY_COLORS[hl.priority];
                          return boxes.map((b, i) => (
                            <button
                              key={`${hid}-${i}`}
                              onClick={() => { setActiveHl(hl); setNoteDraft(hl.note ?? ""); setPriorityDraft(hl.priority); }}
                              className="absolute rounded-sm transition-shadow hover:shadow-lg"
                              style={{
                                left: `${b.x * 100}%`,
                                top: `${b.y * 100}%`,
                                width: `${b.w * 100}%`,
                                height: `${b.h * 100}%`,
                                background: c.fill,
                                border: `1.5px solid ${c.border}`,
                                opacity: selectedIds.has(hid) ? 1 : 0.85,
                                outline: selectedIds.has(hid) ? "2px dashed rgba(0,0,0,0.35)" : "none",
                              }}
                              title={hl.note || hl.text}
                            />
                          ));
                        })}
                      </div>
                      {dragRect && (
                        <div
                          className="absolute rounded-sm border-2 border-dashed border-primary bg-primary/20 pointer-events-none"
                          style={{
                            left: `${dragRect.x * 100}%`, top: `${dragRect.y * 100}%`,
                            width: `${dragRect.w * 100}%`, height: `${dragRect.h * 100}%`,
                          }}
                        />
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground p-8 text-center">No image</p>
                  )}
                  {addMode && (
                    <p className="absolute top-5 left-1/2 -translate-x-1/2 bg-black/70 text-white text-xs px-3 py-1.5 rounded-full pointer-events-none">
                      Drag over a section of the page to highlight it
                    </p>
                  )}
                </div>
              </TabsContent>
            </Card>

            {/* Edit toolbar */}
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <Button variant="outline" size="sm" onClick={undo} disabled={history.length === 0} className="gap-1.5">
                <Undo2 className="h-3.5 w-3.5" /> Undo
              </Button>
              <Button variant="outline" size="sm" onClick={redo} disabled={future.length === 0} className="gap-1.5">
                <Redo2 className="h-3.5 w-3.5" /> Redo
              </Button>
              <Button variant="outline" size="sm" onClick={handleResetAi} className="gap-1.5">
                <Eraser className="h-3.5 w-3.5" /> Reset AI highlights
              </Button>
              <span className="text-xs text-muted-foreground ml-auto">
                {highlights.length} highlight{highlights.length === 1 ? "" : "s"} · tap a highlight to edit
              </span>
            </div>

            {/* Highlight list */}
            {analysis?.fullText && highlights.length > 0 && (
              <div className="mt-4 space-y-2">
                {highlights.map((hl) => {
                  const c = PRIORITY_COLORS[hl.priority];
                  return (
                    <div key={hl.id} className={`p-3 rounded-lg border ${c.chip} bg-opacity-40`}>
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(hl.id)}
                          onChange={() => toggleSelect(hl.id)}
                          className="mt-1 accent-stone-700"
                          title="Select for summarize"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-stone-900 leading-snug">“{hl.text}”</p>
                          {hl.note && <p className="text-xs text-stone-600 mt-1">💬 {hl.note}</p>}
                          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            <Badge variant="outline" className="text-[10px] capitalize">{hl.kind.replace("_", " ")}</Badge>
                            <Badge variant="outline" className="text-[10px] capitalize">{hl.source === "ai" ? "AI" : "You"}</Badge>
                            <button onClick={() => cyclePriority(hl)} className="text-[10px] underline underline-offset-2 hover:opacity-75">
                              change priority ({hl.priority})
                            </button>
                            <button
                              onClick={() => { setActiveHl(hl); setNoteDraft(hl.note ?? ""); setPriorityDraft(hl.priority); }}
                              className="text-[10px] underline underline-offset-2 hover:opacity-75"
                            >
                              <StickyNote className="h-3 w-3 inline mr-0.5" />note
                            </button>
                            <button onClick={() => removeHighlight(hl.id)} className="text-[10px] text-red-700 underline underline-offset-2 hover:opacity-75">
                              <Trash2 className="h-3 w-3 inline mr-0.5" />remove
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div className="flex gap-2 pt-1 flex-wrap">
                  <Button variant="outline" size="sm" onClick={handleSummarize} disabled={busy === "summary"} className="gap-1.5">
                    {busy === "summary" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ListChecks className="h-3.5 w-3.5" />}
                    Summarize Highlights{selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleFlashcards} disabled={busy === "cards" || highlights.length === 0} className="gap-1.5">
                    {busy === "cards" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CreditCard className="h-3.5 w-3.5" />}
                    Create Flashcards
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setQuizOpen(true)} disabled={highlights.length === 0} className="gap-1.5">
                    <HelpCircle className="h-3.5 w-3.5" /> Quiz Me On Highlights
                  </Button>
                </div>
                {summary && (
                  <Card className="vintage-card">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-serif-vintage font-bold text-sm flex items-center gap-1.5">
                          <Sparkles className="h-4 w-4 text-accent" /> Summary of selected highlights
                        </h3>
                        <button onClick={() => setSummary(null)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
                      </div>
                      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{summary}</p>
                      <p className="text-[10px] text-muted-foreground mt-2">AI explanation based only on the highlighted textbook snippets.</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {analysis && analysis.fullText && highlights.length === 0 && (
              <p className="text-sm text-muted-foreground mt-4 text-center">
                No highlights yet. Tap “Highlight Important Things” or add your own with the Add highlight tool.
              </p>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-2 space-y-4">
            {/* Readability / transcription */}
            <Card className="vintage-card">
              <CardContent className="p-4">
                <h3 className="font-serif-vintage font-bold text-sm mb-2 flex items-center gap-1.5">
                  <ScanLine className="h-4 w-4 text-primary" /> Page reading
                </h3>
                {analysis ? (
                  <>
                    <div className="flex items-center gap-2 mb-2 text-xs">
                      <Badge variant={analysis.readability === "clear" ? "default" : "secondary"} className="capitalize">
                        {analysis.readability.replace("_", " ")}
                      </Badge>
                      <span className="text-muted-foreground">confidence {Math.round((analysis.ocrConfidence ?? 0) * 100)}%</span>
                      {analysis.pageNumber ? <Badge variant="outline">Printed page {analysis.pageNumber}</Badge> : null}
                    </div>
                    <div className="max-h-40 overflow-auto text-xs text-muted-foreground whitespace-pre-wrap bg-secondary/50 rounded-lg p-2.5 leading-relaxed">
                      {analysis.fullText || "No text could be read."}
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Run “Highlight Important Things” to read this page with AI.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Study This Page */}
            <Card className="vintage-card">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-serif-vintage font-bold text-sm flex items-center gap-1.5">
                    <GraduationCap className="h-4 w-4 text-primary" /> Study This Page
                  </h3>
                  <Button size="sm" variant="outline" onClick={handleStudyPage} disabled={panelLoading} className="h-7 gap-1 text-xs">
                    {panelLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <BookOpen className="h-3 w-3" />}
                    {panel ? "Refresh" : "Generate"}
                  </Button>
                </div>
                {panel ? (
                  <div className="space-y-3 text-sm max-h-[60vh] overflow-auto pr-1">
                    <div>
                      <p className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-1">What You Need To Know</p>
                      <ul className="list-disc pl-4 space-y-0.5 text-xs">{panel.whatToKnow.map((t, i) => <li key={i}>{t}</li>)}</ul>
                    </div>
                    {panel.terms.length > 0 && (
                      <div>
                        <p className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-1">Important Terms</p>
                        {panel.terms.map((t, i) => (
                          <p key={i} className="text-xs mb-1"><span className="font-semibold">{t.term}:</span> {t.meaning}</p>
                        ))}
                      </div>
                    )}
                    {panel.facts.length > 0 && (
                      <div>
                        <p className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-1">Important Facts</p>
                        <ul className="list-disc pl-4 space-y-0.5 text-xs">{panel.facts.map((t, i) => <li key={i}>{t}</li>)}</ul>
                      </div>
                    )}
                    {panel.diagramInfo.length > 0 && (
                      <div>
                        <p className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-1">Important Diagram Info</p>
                        <ul className="list-disc pl-4 space-y-0.5 text-xs">{panel.diagramInfo.map((t, i) => <li key={i}>{t}</li>)}</ul>
                      </div>
                    )}
                    {panel.quickQuestions.length > 0 && (
                      <div>
                        <p className="font-semibold text-xs uppercase tracking-wide text-muted-foreground mb-1">Quick Questions</p>
                        <ul className="list-decimal pl-4 space-y-0.5 text-xs">{panel.quickQuestions.map((t, i) => <li key={i}>{t}</li>)}</ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    A small study panel based only on this page: what to know, terms, facts, diagram info, and 5 quick questions.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Flashcard count */}
            {flashcards && flashcards.length > 0 && (
              <p className="text-xs text-muted-foreground text-center">
                {flashcards.length} flashcards saved from this page's highlights.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Note / priority dialog */}
      <Dialog open={!!activeHl} onOpenChange={(o) => !o && setActiveHl(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif-vintage">Edit Highlight</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground italic">“{activeHl?.text}”</p>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Priority</Label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {(["high", "medium", "low"] as HighlightPriority[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPriorityDraft(p)}
                    className={`p-2 rounded-lg border text-xs font-medium capitalize transition-all ${priorityDraft === p ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/30"}`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs">Note</Label>
              <Textarea value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} rows={2} className="mt-1" placeholder="Why does this matter?" />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => activeHl && removeHighlight(activeHl.id)}>
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
            </Button>
            <Button onClick={saveNote}><Check className="h-3.5 w-3.5 mr-1" /> Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Flashcards dialog */}
      <Dialog open={cardsOpen} onOpenChange={setCardsOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="font-serif-vintage">Flashcards from Highlights</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {cards.map((c, i) => (
              <div key={i} className="p-3 bg-secondary rounded-lg">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Front</p>
                <p className="text-sm font-medium">{c.front}</p>
                <p className="text-xs uppercase tracking-wide text-muted-foreground mt-2">Back</p>
                <p className="text-sm">{c.back}</p>
              </div>
            ))}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setCardsOpen(false)}>Close</Button>
            <Button onClick={handleSaveCards}>Save {cards.length} cards</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quiz dialog */}
      <Dialog open={quizOpen} onOpenChange={(o) => { setQuizOpen(o); if (!o) setQuiz(null); }}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="font-serif-vintage">Quiz Me On Highlights</DialogTitle>
          </DialogHeader>
          {!quiz ? (
            <div className="space-y-4">
              <div>
                <Label className="text-xs">Number of questions</Label>
                <div className="grid grid-cols-4 gap-2 mt-1">
                  {([5, 10, 15, 20] as const).map((n) => (
                    <button key={n} onClick={() => setQuizConfig((c) => ({ ...c, count: n }))}
                      className={`p-2 rounded-lg border text-sm font-medium transition-all ${quizConfig.count === n ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/30"}`}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-xs">Difficulty</Label>
                <div className="grid grid-cols-4 gap-2 mt-1">
                  {(["easy", "medium", "hard", "mixed"] as const).map((d) => (
                    <button key={d} onClick={() => setQuizConfig((c) => ({ ...c, difficulty: d }))}
                      className={`p-2 rounded-lg border text-xs font-medium capitalize transition-all ${quizConfig.difficulty === d ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/30"}`}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <Button onClick={handleQuiz} disabled={busy === "quiz"} className="w-full gap-2">
                {busy === "quiz" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Generate Quiz
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {quiz.map((q, i) => {
                const answered = quizAnswers[i];
                return (
                  <div key={i} className="p-3 border border-border rounded-lg">
                    <p className="text-sm font-medium mb-2">{i + 1}. {q.questionText}</p>
                    <div className="space-y-1.5">
                      {q.options.map((opt, oi) => {
                        const isCorrect = opt === q.correctAnswer;
                        const chosen = answered === opt;
                        return (
                          <button
                            key={oi}
                            disabled={!!answered}
                            onClick={() => setQuizAnswers((a) => ({ ...a, [i]: opt }))}
                            className={`w-full text-left text-xs px-3 py-2 rounded-lg border transition-all ${
                              answered
                                ? isCorrect ? "border-green-500 bg-green-50 text-green-900" : chosen ? "border-red-400 bg-red-50 text-red-900" : "border-border opacity-60"
                                : "border-border hover:border-primary/40"
                            }`}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                    {answered && (
                      <p className="text-xs text-muted-foreground mt-2">
                        {answered === q.correctAnswer ? "✅ Correct. " : `❌ Answer: ${q.correctAnswer}. `}
                        {q.explanation}
                      </p>
                    )}
                  </div>
                );
              })}
              <div className="flex items-center justify-between pt-1">
                <p className="text-sm font-bold">Score: {quizScore}/{quiz.length}</p>
                <Button size="sm" variant="outline" onClick={handleQuiz}>Retake</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
