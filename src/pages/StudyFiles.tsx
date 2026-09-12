import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useQuery, useMutation, useAction } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  FolderOpen, Plus, Trash2, Pencil, Download, FileText, BookOpen, MoreVertical, Library,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import type { Doc, Id } from "@/convex/_generated/dataModel";

export default function StudyFiles() {
  const navigate = useNavigate();
  const files = useQuery(api.studyAi.listStudyFiles);
  const removeFile = useMutation(api.studyAi.removeStudyFile);
  const renameFile = useMutation(api.studyAi.renameStudyFile);

  const [renameTarget, setRenameTarget] = useState<Doc<"studyFiles"> | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const handleRename = async () => {
    if (!renameTarget || !renameValue.trim()) return;
    try {
      await renameFile({ id: renameTarget._id, title: renameValue.trim() });
      toast.success("Renamed");
      setRenameTarget(null);
    } catch {
      toast.error("Could not rename file");
    }
  };

  const handleDelete = async (id: Doc<"studyFiles">["_id"]) => {
    try {
      await removeFile({ id });
      toast.success("Study file deleted");
    } catch {
      toast.error("Could not delete file");
    }
  };

  const subjectLabel = (s: string) => (s === "physics" ? "Physics" : "Biology");

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-serif-vintage text-2xl sm:text-3xl font-bold text-foreground">
              My Study Files
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Your generated revision documents, ready to open or download
            </p>
          </div>
          <Button onClick={() => setShowCreate(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New from pages</span>
          </Button>
        </div>

        {files === undefined ? (
          <div className="text-sm text-muted-foreground animate-pulse">Loading…</div>
        ) : files.length === 0 ? (
          <Card className="vintage-card">
            <CardContent className="p-12 text-center">
              <Library className="h-14 w-14 mx-auto mb-4 text-muted-foreground/20" />
              <h3 className="font-serif-vintage text-lg font-bold text-foreground mb-2">
                No study files yet
              </h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
                Open a page in Page Studio, tap “Highlight Important Things”, then “Create Study File”
                to build your first revision document.
              </p>
              <div className="flex gap-2 justify-center flex-wrap">
                <Link to="/books">
                  <Button className="gap-2"><BookOpen className="h-4 w-4" /> Go to Books</Button>
                </Link>
                <Button variant="outline" onClick={() => setShowCreate(true)} className="gap-2">
                  <FileText className="h-4 w-4" /> Create from pages
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {files.map((f) => (
              <Card key={f._id} className="vintage-card group relative">
                <CardContent className="p-4">
                  <div
                    className="cursor-pointer"
                    onClick={() => navigate(`/study-files/${f._id}`)}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-serif-vintage font-bold text-sm text-foreground leading-snug group-hover:text-primary transition-colors line-clamp-2">
                        {f.title}
                      </h3>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <button className="p-1 rounded hover:bg-secondary text-muted-foreground shrink-0">
                            <MoreVertical className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/study-files/${f._id}`)}>
                            <FolderOpen className="h-3.5 w-3.5 mr-2" /> Open
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setRenameTarget(f);
                              setRenameValue(f.title);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5 mr-2" /> Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate(`/study-files/${f._id}?download=1`)}>
                            <Download className="h-3.5 w-3.5 mr-2" /> Download
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => handleDelete(f._id)}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      <Badge variant="secondary" className="text-[10px]">{subjectLabel(f.subject)}</Badge>
                      <Badge variant="secondary" className="text-[10px]">Grade {f.grade}</Badge>
                      <Badge variant="outline" className="text-[10px] capitalize">{f.scope}</Badge>
                    </div>
                    <div className="text-[11px] text-muted-foreground space-y-0.5">
                      <p>{f.pageCount} page{f.pageCount === 1 ? "" : "s"} used</p>
                      <p>Created {new Date(f.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create-from-pages dialog */}
      <CreateFromFileDialog open={showCreate} onOpenChange={setShowCreate} />

      {/* Rename dialog */}
      <Dialog open={!!renameTarget} onOpenChange={(o) => !o && setRenameTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif-vintage">Rename Study File</DialogTitle>
          </DialogHeader>
          <div>
            <Label className="text-xs">Title</Label>
            <Input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleRename()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)}>Cancel</Button>
            <Button onClick={handleRename} disabled={!renameValue.trim()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

/** Simple picker that builds a study file from any analysed pages. */
function CreateFromFileDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const books = useQuery(api.books.listByUser);
  const [selectedBook, setSelectedBook] = useState<string | null>(null);
  const pages = useQuery(
    api.pages.listByBook,
    selectedBook ? { bookId: selectedBook as never } : "skip"
  );
  const generate = useAction(api.studyAiActions.generateStudyFile);
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [scope, setScope] = useState<"pages" | "chapter">("pages");

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreate = async () => {
    if (selected.size === 0) return;
    setBusy(true);
    try {
      const res = await generate({ pageIds: Array.from(selected) as Id<"pages">[], scope });
      onOpenChange(false);
      navigate(`/study-files/${res.studyFileId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create study file", { duration: 6000 });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-auto">
        <DialogHeader>
          <DialogTitle className="font-serif-vintage">Create Study File from Pages</DialogTitle>
        </DialogHeader>
        {!books || books.length === 0 ? (
          <p className="text-sm text-muted-foreground">Upload pages to a book first.</p>
        ) : (
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Book</Label>
              <select
                value={selectedBook ?? ""}
                onChange={(e) => {
                  setSelectedBook(e.target.value);
                  setSelected(new Set());
                }}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="" disabled>Select a book…</option>
                {books.map((b) => (
                  <option key={b._id} value={b._id}>{b.title}</option>
                ))}
              </select>
            </div>
            {pages && pages.length > 0 && (
              <>
                <div>
                  <Label className="text-xs">Scope</Label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <button
                      onClick={() => setScope("pages")}
                      className={`p-2 rounded-lg border text-xs font-medium transition-all ${scope === "pages" ? "border-primary bg-primary/10 text-primary" : "border-border"}`}
                    >
                      Combined study guide
                    </button>
                    <button
                      onClick={() => setScope("chapter")}
                      className={`p-2 rounded-lg border text-xs font-medium transition-all ${scope === "chapter" ? "border-primary bg-primary/10 text-primary" : "border-border"}`}
                    >
                      Chapter study guide
                    </button>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">
                    Pages ({selected.size} selected — analysed pages only)
                  </Label>
                  <div className="grid grid-cols-4 gap-2 mt-1">
                    {pages.map((p, i) => (
                      <button
                        key={p._id}
                        onClick={() => toggle(p._id)}
                        className={`relative aspect-[3/4] rounded-lg overflow-hidden border-2 transition-all ${
                          selected.has(p._id) ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/30"
                        }`}
                      >
                        <img src={p.imageUrl} alt={`Page ${i + 1}`} className="w-full h-full object-cover" />
                        <span className="absolute bottom-1 right-1 bg-black/60 text-white text-[9px] px-1 rounded">
                          {i + 1}
                        </span>
                        {(p.status === "uploading" || p.status === "processing") && (
                          <span className="absolute top-1 left-1 bg-amber-500 text-white text-[8px] px-1 rounded">…</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
            <Button
              onClick={handleCreate}
              disabled={busy || selected.size === 0}
              className="w-full gap-2"
            >
              {busy ? "Creating…" : `Create Study File (${selected.size} pages)`}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
