import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Download, Printer, FileDown, WifiOff, Image as ImageIcon, X, BookOpen,
} from "lucide-react";
import { downloadDocx, printStudyFile } from "@/lib/studyFileExport";
import type { StudyFileSection } from "@/convex/studyAi";
import type { Doc, Id } from "@/convex/_generated/dataModel";

type StudyFileView = Doc<"studyFiles"> & {
  sections: StudyFileSection[];
  pageIdList: string[];
};

const CACHE_PREFIX = "studyai:studyfile:";

function readCache(id: string): StudyFileView | null {
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${id}`);
    return raw ? (JSON.parse(raw) as StudyFileView) : null;
  } catch {
    return null;
  }
}

function writeCache(file: StudyFileView) {
  try {
    localStorage.setItem(
      `${CACHE_PREFIX}${file._id}`,
      JSON.stringify({
        _id: file._id,
        title: file.title,
        subject: file.subject,
        grade: file.grade,
        chapterTitle: file.chapterTitle,
        unitTitle: file.unitTitle,
        scope: file.scope,
        pageCount: file.pageCount,
        pageIds: file.pageIds,
        sections: file.sections,
        createdAt: file.createdAt,
        updatedAt: file.updatedAt,
      }),
    );
  } catch {
    // Storage full — skip caching silently
  }
}

export default function StudyFileDetail() {
  const { fileId } = useParams<{ fileId: string }>();
  const file = useQuery(
    api.studyAi.getStudyFile,
    fileId ? { id: fileId as Id<"studyFiles"> } : "skip"
  );

  const [offline, setOffline] = useState<StudyFileView | null>(null);
  const [lightboxPage, setLightboxPage] = useState<{ url: string; label: string } | null>(null);

  // Offline: hydrate from cache immediately on mount
  useEffect(() => {
    if (!fileId) return;
    const cached = readCache(fileId);
    if (cached) setOffline(cached);
  }, [fileId]);

  // Cache fresh data whenever it arrives
  useEffect(() => {
    if (file) {
      writeCache(file as unknown as StudyFileView);
      setOffline(null);
    }
  }, [file?._id, (file as StudyFileView | undefined)?.updatedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!fileId) return null;

  const view: StudyFileView | null = file
    ? (file as unknown as StudyFileView)
    : offline;

  if (!view) {
    return (
      <AppLayout>
        <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
          <div className="animate-pulse text-muted-foreground">Loading study file…</div>
        </div>
      </AppLayout>
    );
  }

  const viewMeta = {
    title: view.title,
    subject: view.subject,
    grade: view.grade,
    chapterTitle: view.chapterTitle ?? undefined,
    unitTitle: view.unitTitle ?? undefined,
    scope: view.scope,
    pageCount: view.pageCount,
    createdAt: view.createdAt,
  };

  const handlePrint = () => printStudyFile(viewMeta, view.sections);
  const handleDocx = () => {
    downloadDocx(viewMeta, view.sections);
    toast.success("Editable document downloaded (.doc — opens in Word/Google Docs)");
  };

  return (
    <AppLayout>
      <StudyFileContent
        view={view}
        showOfflineBadge={offline !== null && !file}
        onPrint={handlePrint}
        onDocx={handleDocx}
        onLightbox={setLightboxPage}
      />

      {lightboxPage && (
        <div
          className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightboxPage(null)}
        >
          <div className="max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-white text-sm font-medium flex items-center gap-2">
                <ImageIcon className="h-4 w-4" /> {lightboxPage.label}
              </p>
              <button onClick={() => setLightboxPage(null)} className="text-white/80 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <img src={lightboxPage.url} alt={lightboxPage.label} className="w-full rounded-lg shadow-2xl" />
            <p className="text-center text-white/60 text-xs mt-2">
              Textbook page from your uploads
            </p>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

function StudyFileContent({
  view,
  showOfflineBadge,
  onPrint,
  onDocx,
  onLightbox,
}: {
  view: StudyFileView;
  showOfflineBadge: boolean;
  onPrint: () => void;
  onDocx: () => void;
  onLightbox: (p: { url: string; label: string }) => void;
}) {
  // Resolve source page image URLs (only when live data is available)
  const pagesMeta = useQuery(
    api.studyAi.getPagesMeta,
    showOfflineBadge ? "skip" : { pageIds: view.pageIdList.slice(0, 12) as Id<"pages">[] }
  );

  const pageUrls: Record<string, { url: string; label: string }> = {};
  for (const p of pagesMeta ?? []) {
    pageUrls[p.pageId] = {
      url: p.imageUrl,
      label: p.pageNumber ? `Page ${p.pageNumber}` : "Uploaded page",
    };
  }

  if (!view.sections || view.sections.length === 0) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
        <p className="text-sm text-muted-foreground">This study file is empty.</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-6 flex-wrap">
        <div>
          <Link
            to="/study-files"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors mb-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> My Study Files
          </Link>
          <h1 className="font-serif-vintage text-xl sm:text-2xl font-bold text-foreground">
            {view.title}
          </h1>
          <div className="flex flex-wrap gap-1.5 mt-2">
            <Badge variant="secondary">{view.subject === "physics" ? "Physics" : "Biology"}</Badge>
            <Badge variant="secondary">Grade {view.grade}</Badge>
            <Badge variant="outline" className="capitalize">{view.scope}</Badge>
            <Badge variant="outline">{view.pageCount} pages</Badge>
            {showOfflineBadge && (
              <Badge variant="outline" className="gap-1">
                <WifiOff className="h-3 w-3" /> Offline copy
              </Badge>
            )}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={onPrint} className="gap-2">
            <Download className="h-4 w-4" /> Download Study File
          </Button>
          <Button onClick={onDocx} variant="outline" className="gap-2">
            <FileDown className="h-4 w-4" /> DOCX
          </Button>
          <Button onClick={onPrint} variant="outline" className="gap-2">
            <Printer className="h-4 w-4" /> Print
          </Button>
        </div>
      </div>

      {showOfflineBadge && (
        <div className="mb-4 p-2.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-900 text-xs">
          You're viewing a saved offline copy of this study file.
        </div>
      )}

      {/* Document */}
      <Card className="vintage-card">
        <CardContent className="p-5 sm:p-8 studyfile-doc">
          <div className="text-center pb-5 mb-6 border-b-2 border-double border-accent/40">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              {view.chapterTitle || view.unitTitle || "StudyAI UAE"}
            </p>
            <h2 className="font-serif-vintage text-2xl font-bold text-foreground mt-1">
              {view.title}
            </h2>
            <div className="flex flex-wrap justify-center gap-1.5 mt-3">
              <Badge variant="outline" className="text-[10px]">Grade {view.grade}</Badge>
              <Badge variant="outline" className="text-[10px]">
                {view.subject === "physics" ? "Physics" : "Biology"}
              </Badge>
              <Badge variant="outline" className="text-[10px]">{view.pageCount} textbook pages</Badge>
            </div>
          </div>

          {/* Table of contents for longer documents */}
          {view.sections.length > 3 && (
            <div className="bg-secondary/50 border border-border rounded-lg p-4 mb-7">
              <h3 className="font-serif-vintage font-bold text-sm mb-2">Table of Contents</h3>
              <ol className="list-decimal pl-5 space-y-1 text-sm">
                {view.sections.map((s, i) => (
                  <li key={s.id}>
                    <a href={`#sec-${s.id}`} className="hover:text-primary transition-colors">
                      {s.title}
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {view.sections.map((section, si) => (
            <section key={section.id} id={`sec-${section.id}`} className="mb-8 scroll-mt-20">
              <h3 className="font-serif-vintage text-lg font-bold text-primary border-b border-border pb-1.5 mb-3">
                {si + 1}. {section.title}
              </h3>
              {section.blocks.map((block, bi) => {
                switch (block.kind) {
                  case "paragraph":
                    return (
                      <div key={bi} className="mb-3">
                        <p className="text-sm leading-relaxed text-foreground">{block.text}</p>
                        <SourceRef source={block.sourcePage} pageUrls={pageUrls} onOpen={onLightbox} />
                      </div>
                    );
                  case "bullets":
                    return (
                      <div key={bi} className="mb-3">
                        <ul className="list-disc pl-5 space-y-1.5 text-sm">
                          {block.items.map((it, i) => <li key={i} className="leading-relaxed">{it}</li>)}
                        </ul>
                        <SourceRef source={block.sourcePage} pageUrls={pageUrls} onOpen={onLightbox} />
                      </div>
                    );
                  case "numbered":
                    return (
                      <div key={bi} className="mb-3">
                        <ol className="list-decimal pl-5 space-y-1.5 text-sm">
                          {block.items.map((it, i) => <li key={i} className="leading-relaxed">{it}</li>)}
                        </ol>
                        <SourceRef source={block.sourcePage} pageUrls={pageUrls} onOpen={onLightbox} />
                      </div>
                    );
                  case "definition":
                    return (
                      <div key={bi} className="mb-3 p-3 bg-secondary/50 border-l-4 border-accent rounded-r-lg">
                        <p className="text-sm leading-relaxed">
                          <span className="font-bold text-primary">{block.term}</span>
                          <span className="text-muted-foreground">: </span>
                          {block.meaning}
                        </p>
                        <SourceRef source={block.sourcePage} pageUrls={pageUrls} onOpen={onLightbox} />
                      </div>
                    );
                  case "formula":
                    return (
                      <div key={bi} className="mb-4 border border-border rounded-lg overflow-hidden">
                        <div className="bg-secondary/70 px-4 py-3 text-center font-serif-vintage text-lg font-bold text-foreground">
                          {block.formula}
                        </div>
                        <table className="w-full text-xs">
                          <tbody>
                            <Row label="What each symbol means" value={block.symbols} />
                            <Row label="SI units" value={block.units} />
                            <Row label="When to use it" value={block.whenToUse} />
                            {block.example && <Row label="Example problem" value={block.example} />}
                            {block.solution && <Row label="Solution" value={block.solution} />}
                          </tbody>
                        </table>
                        <div className="px-3 pb-2 pt-1">
                          <SourceRef source={block.sourcePage} pageUrls={pageUrls} onOpen={onLightbox} />
                        </div>
                      </div>
                    );
                  case "table":
                    return (
                      <div key={bi} className="mb-3 overflow-x-auto">
                        <table className="w-full text-xs border-collapse">
                          <thead>
                            <tr>
                              {block.headers.map((h, i) => (
                                <th key={i} className="border border-border bg-secondary/60 px-3 py-2 text-left font-semibold">
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {block.rows.map((r, ri) => (
                              <tr key={ri}>
                                {r.map((c, ci) => (
                                  <td key={ci} className="border border-border px-3 py-2">{c}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <SourceRef source={block.sourcePage} pageUrls={pageUrls} onOpen={onLightbox} />
                      </div>
                    );
                  case "check":
                    return (
                      <div key={bi} className="mb-2.5 p-3.5 bg-blue-50/60 border border-blue-200/60 rounded-lg">
                        <p className="text-sm font-medium">{block.question}</p>
                        <p className="text-xs text-muted-foreground mt-1.5">
                          <span className="font-semibold">Answer hint:</span> {block.hint}
                        </p>
                      </div>
                    );
                  default:
                    return null;
                }
              })}
            </section>
          ))}

          <p className="text-center text-[11px] text-muted-foreground mt-10 pt-4 border-t border-border">
            Generated with StudyAI UAE · Based on your uploaded textbook pages ·{" "}
            {new Date(view.createdAt).toLocaleDateString()}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <th className="border-t border-border bg-secondary/40 px-3 py-2 text-left font-semibold w-2/5 align-top text-muted-foreground">
        {label}
      </th>
      <td className="border-t border-border px-3 py-2 text-foreground">{value}</td>
    </tr>
  );
}

function SourceRef({
  source,
  pageUrls,
  onOpen,
}: {
  source?: string | null;
  pageUrls: Record<string, { url: string; label: string }>;
  onOpen: (p: { url: string; label: string }) => void;
}) {
  if (!source) return null;
  const match = Object.values(pageUrls).find((p) => p.label === source);
  return (
    <button
      onClick={() => match && onOpen(match)}
      disabled={!match}
      className="inline-flex items-center gap-1 text-[10px] text-accent hover:underline mt-1 font-medium disabled:opacity-60 disabled:cursor-default"
      title={match ? "Open the textbook page image" : "Page image not available"}
    >
      <BookOpen className="h-3 w-3" /> Source: {source}
    </button>
  );
}
