import { useState, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useParams, useNavigate, Link } from "react-router";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Upload,
  ImageIcon,
  ChevronRight,
  ChevronDown,
  LayoutGrid,
  Rows3,
  CheckCircle2,
  Loader2,
  X,
  FileText,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Id } from "@/convex/_generated/dataModel";

function PageCard({
  page,
  isDragging,
  isSelected,
  onSelect,
  onStartDrag,
}: {
  page: { _id: Id<"pages">; imageUrl: string; status: string; extractedText: string };
  isDragging: boolean;
  isSelected: boolean;
  onSelect: (id: Id<"pages">) => void;
  onStartDrag: (e: React.DragEvent, id: Id<"pages">) => void;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => onStartDrag(e, page._id)}
      onDragEnd={() => {}}
      onClick={() => onSelect(page._id)}
      className={`relative aspect-[3/4] rounded-lg overflow-hidden border-2 transition-all cursor-pointer group ${
        isSelected
          ? "border-primary ring-2 ring-primary/20"
          : isDragging
          ? "border-primary/50 opacity-50"
          : "border-border hover:border-primary/30"
      }`}
    >
      {page.imageUrl ? (
        <img src={page.imageUrl} alt="Page" className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <div className="flex items-center justify-center h-full bg-secondary">
          <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
        </div>
      )}
      {/* Status badge */}
      <div className="absolute top-1.5 left-1.5">
        {page.status === "processed" && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-800">
            <CheckCircle2 className="h-3 w-3" />
            Read
          </span>
        )}
        {page.status === "processing" && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-800">
            <Loader2 className="h-3 w-3 animate-spin" />
            Processing
          </span>
        )}
        {page.status === "unreadable" && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800">
            <X className="h-3 w-3" />
            Unreadable
          </span>
        )}
      </div>
      {/* Order number */}
      <div className="absolute bottom-1.5 right-1.5">
        <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium bg-black/50 text-white">
          {page.order ?? 0}
        </span>
      </div>
      {/* Selected indicator */}
      {isSelected && (
        <div className="absolute inset-0 border-2 border-primary rounded-lg pointer-events-none" />
      )}
    </div>
  );
}

export default function Organize() {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const bookIdTyped = bookId as Id<"books"> | undefined;

  const book = useQuery(api.books.get, bookId ? { bookId: bookIdTyped } : "skip");
  const pages = useQuery(
    api.pages.listByBook,
    bookId ? { bookId: bookIdTyped } : "skip"
  );
  const processPages = useMutation(api.processPages.processPageBatch);

  const [view, setView] = useState<"grid" | "list">("grid");
  const [selectedPageIds, setSelectedPageIds] = useState<Set<Id<"pages">>>(new Set());
  const [processing, setProcessing] = useState(false);
  const [dragId, setDragId] = useState<Id<"pages"> | null>(null);
  const [reorderPending, setReorderPending] = useState(false);

  const pageIds = pages ?? [];
  const processedCount = pageIds.filter((p) => p.status === "processed").length;
  const totalCount = pageIds.length;

  const toggleSelection = useCallback((id: Id<"pages">) => {
    setSelectedPageIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const startDrag = useCallback((e: React.DragEvent, id: Id<"pages">) => {
    setDragId(id);
    e.dataTransfer.setData("text/plain", id.toString());
  }, []);

  const handleProcessSelected = async () => {
    if (selectedPageIds.size === 0) return;
    setProcessing(true);
    try {
      await processPages({ pageIds: Array.from(selectedPageIds) });
      setSelectedPageIds(new Set());
    } catch (e) {
      console.error("Processing failed:", e);
    } finally {
      setProcessing(false);
    }
  };

  const handleProcessAll = async () => {
    setProcessing(true);
    try {
      await processPages({ pageIds: pageIds.map((p) => p._id) });
    } catch (e) {
      console.error("Processing failed:", e);
    } finally {
      setProcessing(false);
    }
  };

  if (!bookId || !book) {
    return (
      <AppLayout>
        <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
          <div className="animate-pulse text-muted-foreground">Loading organizer...</div>
        </div>
      </AppLayout>
    );
  }

  if (!pages || pages.length === 0) {
    return (
      <AppLayout>
        <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
          <Link to="/books" className="inline-flex items-center gap-2 text-sm text-primary hover:underline mb-4">
            <ArrowRight className="h-4 w-4" />
            Back to Books
          </Link>
          <Card className="vintage-card">
            <CardContent className="p-12 text-center">
              <LayoutGrid className="h-12 w-12 mx-auto mb-4 text-muted-foreground/20" />
              <h3 className="font-serif-vintage text-lg font-bold text-foreground mb-2">No Pages Yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Upload pages first, then come back here to organize them into chapters and lessons.
              </p>
              <Link to="/books">
                <Button className="gap-2">
                  <Upload className="h-4 w-4" />
                  Upload Pages
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <Link
              to="/books"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors mb-2"
            >
              <ArrowRight className="h-3.5 w-3.5 rotate-180" />
              {book.title}
            </Link>
            <h1 className="font-serif-vintage text-2xl sm:text-3xl font-bold text-foreground">
              Organize & Analyze
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Drag to reorder · Select pages to process · Map to lessons
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex bg-secondary rounded-lg p-0.5">
              <button
                onClick={() => setView("grid")}
                className={`p-1.5 rounded transition-colors ${view === "grid" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"}`}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setView("list")}
                className={`p-1.5 rounded transition-colors ${view === "list" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Rows3 className="h-4 w-4" />
              </button>
            </div>
            {/* Select all */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (selectedPageIds.size === pageIds.length) {
                  setSelectedPageIds(new Set());
                } else {
                  setSelectedPageIds(new Set(pageIds.map((p) => p._id)));
                }
              }}
              className="gap-1.5"
            >
              {selectedPageIds.size === pageIds.length ? "Deselect All" : "Select All"}
            </Button>
          </div>
        </div>

        {/* Status bar */}
        <div className="flex items-center gap-4 mb-4 text-sm flex-wrap">
          <Badge variant="secondary" className="gap-1.5">
            <span className="font-medium">{totalCount}</span> pages
          </Badge>
          <Badge variant="secondary" className="gap-1.5">
            <CheckCircle2 className="h-3 w-3 text-green-600" />
            {processedCount} read
          </Badge>
          {selectedPageIds.size > 0 && (
            <Badge variant="outline" className="gap-1.5 text-primary">
              {selectedPageIds.size} selected
            </Badge>
          )}
        </div>

        {/* Processing bar */}
        <AnimatePresence>
          {processing && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 overflow-hidden"
            >
              <div className="p-3 bg-secondary rounded-lg flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm font-medium">Analyzing pages with vision AI...</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Selection action bar */}
        {selectedPageIds.size > 0 && (
          <div className="mb-4 p-3 bg-primary/5 rounded-lg border border-primary/20 flex items-center justify-between">
            <span className="text-sm font-medium">
              {selectedPageIds.size} page{selectedPageIds.size > 1 ? "s" : ""} selected
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setSelectedPageIds(new Set())}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleProcessSelected} disabled={processing} className="gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                {processing ? "Processing..." : "Analyze Selected"}
              </Button>
            </div>
          </div>
        )}

        {/* Pages grid/list */}
        {view === "grid" ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {pageIds.map((page) => (
              <PageCard
                key={page._id}
                page={page}
                isDragging={dragId === page._id}
                isSelected={selectedPageIds.has(page._id)}
                onSelect={toggleSelection}
                onStartDrag={startDrag}
              />
            ))}
          </div>
        ) : (
          <Card className="vintage-card">
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">#</th>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Extracted Text</th>
                    <th className="text-right p-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageIds.map((page, i) => (
                    <tr
                      key={page._id}
                      className={`border-b border-border/50 cursor-pointer transition-colors ${
                        selectedPageIds.has(page._id) ? "bg-primary/5" : "hover:bg-secondary/30"
                      }`}
                      onClick={() => toggleSelection(page._id)}
                    >
                      <td className="p-3 font-mono text-xs text-muted-foreground">{i + 1}</td>
                      <td className="p-3">
                        <Badge variant={page.status === "processed" ? "default" : "secondary"} className="capitalize">
                          {page.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-xs text-muted-foreground max-w-xs truncate">
                        {page.extractedText ? page.extractedText.slice(0, 80) + "..." : "— not analyzed yet —"}
                      </td>
                      <td className="p-3 text-right">
                        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={(e) => { e.stopPropagation(); toggleSelection(page._id); }}>
                          {selectedPageIds.has(page._id) ? "Selected" : "Select"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}

        {/* Bottom actions */}
        <div className="mt-6 flex items-center justify-between gap-4 flex-wrap">
          <Button
            variant="outline"
            onClick={handleProcessAll}
            disabled={processing || processedCount === totalCount}
            className="gap-2"
          >
            <Sparkles className={`h-4 w-4 ${processing ? "animate-spin" : ""}`} />
            {processedCount === totalCount ? "All Pages Already Read" : "Analyze All Pages"}
          </Button>
          <div className="text-xs text-muted-foreground">
            {processedCount > 0 && totalCount > 0 ? (
            <span className="text-primary font-medium">{Math.round((processedCount / totalCount) * 100)}% of pages analyzed</span>
          </div>
        </div>

        {/* Next step: create lessons from analyzed pages */}
        {processedCount > 0 && (
          <div className="mt-8 pt-6 border-t border-border">
            <h2 className="font-serif-vintage font-bold text-sm text-muted-foreground uppercase tracking-wider mb-3">
              What's Next?
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Card className="vintage-card p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <FileText className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium text-sm text-foreground">Create Chapters</h3><p className="text-xs text-muted-foreground mt-0.5">
                      Group your read pages into chapters and lessons after analysis.
                    </p>
                  </div>
                </div>
              </Card>
              <Card className="vintage-card p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Sparkles className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium text-sm text-foreground">Generate Study Material</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Create study checklists, flashcards, and quizzes from analyzed pages.
                    </p>
                  </div>
                </div>
              </Card>
              <Card className="vintage-card p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <ChevronRight className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium text-sm text-foreground">Start Studying</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Open a lesson to see your study plan, quiz, and AI tutor.
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
