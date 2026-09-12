import { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useQuery, useAction, useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, Highlighter, Loader2, CheckCircle2, AlertTriangle, Sparkles, FileText, Upload,
} from "lucide-react";

export default function BookPages() {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const typedBookId = bookId as Id<"books"> | undefined;

  const book = useQuery(api.books.get, typedBookId ? { bookId: typedBookId } : "skip");
  const pages = useQuery(api.pages.listByBook, typedBookId ? { bookId: typedBookId } : "skip");
  const analyze = useAction(api.studyAiActions.analyzePage);
  const firstOwnership = useQuery(
    api.pages.getPageOwnership,
    pages && pages.length > 0 ? { pageId: pages[0]._id } : "skip"
  );
  const claimBook = useMutation(api.pages.claimBookContent);

  // Recover content left under an anonymous session (uploaded before sign-in)
  // so AI actions accept the current user.
  useEffect(() => {
    if (firstOwnership && !firstOwnership.mine && firstOwnership.claimable && typedBookId) {
      claimBook({ bookId: typedBookId })
        .then(() => toast.success("Recovered your pages into this account"))
        .catch(() => {});
    }
  }, [firstOwnership?.claimable, firstOwnership?.mine, typedBookId]); // eslint-disable-line react-hooks/exhaustive-deps

  const [busyPage, setBusyPage] = useState<string | null>(null);
  const [bulk, setBulk] = useState<{ done: number; total: number } | null>(null);

  const handleHighlightPage = async (pageId: Id<"pages">) => {
    if (!pages) return;
    const page = pages.find((p) => p._id === pageId);
    if (!page) return;
    setBusyPage(pageId);
    try {
      await analyze({ pageId, imageUrl: page.imageUrl });
      navigate(`/books/${bookId}/pages/${pageId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Analysis failed", { duration: 6000 });
    } finally {
      setBusyPage(null);
    }
  };

  const handleHighlightAll = async () => {
    if (!pages) return;
    const targets = pages.filter((p) => p.status !== "processed");
    if (targets.length === 0) {
      toast.info("All pages are already analysed — open any page to see its highlights");
      return;
    }
    setBulk({ done: 0, total: targets.length });
    let ok = 0;
    let failed = 0;
    for (const p of targets) {
      try {
        await analyze({ pageId: p._id, imageUrl: p.imageUrl });
        ok++;
      } catch {
        failed++;
      }
      setBulk((b) => (b ? { ...b, done: b.done + 1 } : b));
    }
    setBulk(null);
    if (failed > 0) {
      toast.warning(`Highlighted ${ok} pages. ${failed} could not be processed (check photo quality).`);
    } else {
      toast.success(`Highlighted ${ok} pages`);
    }
  };

  const processed = pages?.filter((p) => p.status === "processed").length ?? 0;

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
        <div className="flex items-start justify-between gap-3 mb-6 flex-wrap">
          <div>
            <Link
              to="/books"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors mb-1"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> My Books
            </Link>
            <h1 className="font-serif-vintage text-xl sm:text-2xl font-bold text-foreground">
              {book?.title ?? "Pages"}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {pages ? `${processed}/${pages.length} pages analysed` : "Loading…"}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={handleHighlightAll} disabled={!!bulk || !pages?.length} className="gap-2">
              {bulk ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Highlight All Pages
            </Button>
            <CreateAllPagesStudyFileButton
              pages={pages ?? []}
              disabled={!pages?.length || processed === 0}
            />
            <Link to={`/books/${bookId}/organize`}>
              <Button variant="ghost" className="gap-2"><Upload className="h-4 w-4" /> Add / manage</Button>
            </Link>
          </div>
        </div>

        {bulk && (
          <div className="mb-4 p-3 bg-secondary rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-sm font-medium">Highlighting pages… {bulk.done}/{bulk.total}</span>
            </div>
            <div className="progress-vintage h-2">
              <div className="progress-vintage-fill" style={{ width: `${(bulk.done / bulk.total) * 100}%` }} />
            </div>
          </div>
        )}

        {!pages || pages.length === 0 ? (
          <Card className="vintage-card">
            <CardContent className="p-12 text-center">
              <Upload className="h-12 w-12 mx-auto mb-3 text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground mb-3">No pages in this book yet</p>
              <Link to={`/books/${bookId}/organize`}>
                <Button>Upload Pages</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {pages.map((page, i) => (
              <Card key={page._id} className="vintage-card overflow-hidden group">
                <div
                  className="relative aspect-[3/4] bg-secondary cursor-pointer"
                  onClick={() => navigate(`/books/${bookId}/pages/${page._id}`)}
                >
                  <img src={page.imageUrl} alt={`Page ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
                  <div className="absolute top-1.5 left-1.5">
                    {page.status === "processed" && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-800">
                        <CheckCircle2 className="h-3 w-3" /> Read
                      </span>
                    )}
                    {page.status === "processing" && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-800">
                        <Loader2 className="h-3 w-3 animate-spin" /> Processing
                      </span>
                    )}
                    {page.status === "unreadable" && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800">
                        <AlertTriangle className="h-3 w-3" /> Blurry
                      </span>
                    )}
                  </div>
                  <span className="absolute bottom-1.5 right-1.5 bg-black/60 text-white text-[10px] px-1.5 rounded">
                    {i + 1}
                  </span>
                </div>
                <CardContent className="p-2.5 space-y-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full h-7 text-[11px] gap-1"
                    disabled={busyPage === page._id || page.status === "processing"}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleHighlightPage(page._id);
                    }}
                  >
                    {busyPage === page._id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Highlighter className="h-3 w-3" />}
                    {page.status === "processed" ? "Open Highlights" : "Study This Page"}
                  </Button>
                  <p className="text-[10px] text-muted-foreground text-center truncate">
                    {page.lessonTitle || page.chapterTitle || `Page ${i + 1}`}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

/** Button that creates a combined study file from all analysed pages in the book. */
function CreateAllPagesStudyFileButton({
  pages,
  disabled,
}: {
  pages: Array<{ _id: Id<"pages">; status: string }>;
  disabled: boolean;
}) {
  const generate = useAction(api.studyAiActions.generateStudyFile);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const handle = async () => {
    const analysed = pages.filter((p) => p.status === "processed").map((p) => p._id);
    if (analysed.length === 0) {
      toast.error("Analyse at least one page first");
      return;
    }
    setBusy(true);
    try {
      const res = await generate({
        pageIds: analysed,
        scope: analysed.length > 6 ? "chapter" : "pages",
      });
      navigate(`/study-files/${res.studyFileId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create study file", { duration: 6000 });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button onClick={handle} disabled={disabled || busy} className="gap-2">
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
      Create Study File From All Pages
    </Button>
  );
}
