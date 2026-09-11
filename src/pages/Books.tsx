import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { compressImage } from "@/lib/imageCompress";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Upload,
  Camera,
  Plus,
  Trash2,
  BookOpen,
  ImageIcon,
  X,
  GripVertical,
  FileText,
  ChevronRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router";
import type { Id } from "@/convex/_generated/dataModel";

export default function Books() {
  const books = useQuery(api.books.listByUser);
  const createBook = useMutation(api.books.create);
  const removeBook = useMutation(api.books.remove);
  const uploadPage = useMutation(api.pages.upload);
  const updatePageStatus = useMutation(api.pages.updateStatus);
  const removePage = useMutation(api.pages.remove);

  const [showNewBook, setShowNewBook] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [selectedBook, setSelectedBook] = useState<Id<"books"> | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const bookPages = useQuery(
    api.pages.listByBook,
    selectedBook ? { bookId: selectedBook } : "skip"
  );

  const handleCreateBook = async () => {
    if (!newTitle.trim()) return;
    const user = null; // profile comes from context
    await createBook({
      title: newTitle.trim(),
      grade: 9,
      subject: "physics",
      curriculum: "general",
    });
    setNewTitle("");
    setShowNewBook(false);
  };

  const handleFileUpload = useCallback(
    async (files: FileList | null) => {
      if (!files || !selectedBook) return;
      setUploading(true);
      setUploadProgress({ done: 0, total: files.length });

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        // Compress the image to fit within Convex's 1MB limit
        const dataUrl = await compressImage(file);

        await uploadPage({
          bookId: selectedBook,
          imageUrl: dataUrl,
          order: (bookPages?.length ?? 0) + i,
        });

        // Simulate processing status
        setUploadProgress({ done: i + 1, total: files.length });
      }

      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [selectedBook, bookPages, uploadPage]
  );

  const handleDeleteBook = async (bookId: Id<"books">) => {
    await removeBook({ bookId });
    if (selectedBook === bookId) setSelectedBook(null);
  };

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-serif-vintage text-2xl sm:text-3xl font-bold text-foreground">
              My Books
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Upload and manage your textbook pages
            </p>
          </div>
          <Button onClick={() => setShowNewBook(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add Book</span>
          </Button>
        </div>

        {/* New Book Form */}
        <AnimatePresence>
          {showNewBook && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6 overflow-hidden"
            >
              <Card className="vintage-card">
                <CardContent className="p-4">
                  <div className="flex items-end gap-3">
                    <div className="flex-1">
                      <Label className="text-sm font-medium">Book Title</Label>
                      <Input
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        placeholder="e.g. Grade 10 Physics - Term 1"
                        className="mt-1"
                        onKeyDown={(e) => e.key === "Enter" && handleCreateBook()}
                      />
                    </div>
                    <Button onClick={handleCreateBook} disabled={!newTitle.trim()}>
                      Create
                    </Button>
                    <Button variant="ghost" onClick={() => setShowNewBook(false)}>
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Book List */}
          <div className="space-y-3">
            <h2 className="font-serif-vintage font-bold text-sm text-muted-foreground uppercase tracking-wider">
              Your Books
            </h2>
            {books && books.length > 0 ? (
              books.map((book) => (
                <motion.div
                  key={book._id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <button
                    onClick={() => setSelectedBook(book._id)}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                      selectedBook === book._id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/30 bg-card"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <BookOpen className="h-4 w-4 text-primary shrink-0" />
                          <h3 className="font-bold text-sm text-foreground truncate">
                            {book.title}
                          </h3>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Grade {book.grade} · {book.subject === "physics" ? "Physics" : "Biology"}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteBook(book._id);
                        }}
                        className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </button>
                </motion.div>
              ))
            ) : (
              <div className="text-center py-8 text-sm text-muted-foreground">
                <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p>No books yet</p>
                <p className="text-xs mt-1">Create a book to start uploading pages</p>
              </div>
            )}
          </div>

          {/* Pages Panel */}
          <div className="lg:col-span-2">
            {selectedBook ? (
              <Card className="vintage-card">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="font-serif-vintage text-lg">Uploaded Pages</CardTitle>
                    <div className="flex gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        multiple
                        className="hidden"
                        onChange={(e) => handleFileUpload(e.target.files)}
                      />
                      <input
                        ref={cameraInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => handleFileUpload(e.target.files)}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => cameraInputRef.current?.click()}
                        disabled={uploading}
                        className="gap-1.5"
                      >
                        <Camera className="h-3.5 w-3.5" />
                        Camera
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="gap-1.5"
                      >
                        <Upload className="h-3.5 w-3.5" />
                        Upload
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Upload progress */}
                  {uploading && (
                    <div className="mb-4 p-3 bg-secondary rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        <span className="text-sm font-medium">
                          Uploading {uploadProgress.done}/{uploadProgress.total} pages...
                        </span>
                      </div>
                      <div className="progress-vintage h-2">
                        <div
                          className="progress-vintage-fill"
                          style={{
                            width: `${(uploadProgress.done / uploadProgress.total) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Pages grid */}
                  {bookPages && bookPages.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {bookPages.map((page, i) => (
                        <div key={page._id} className="relative group">
                          <div className="aspect-[3/4] rounded-lg overflow-hidden bg-secondary border border-border">
                            {page.imageUrl ? (
                              <img
                                src={page.imageUrl}
                                alt={`Page ${i + 1}`}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <div className="flex items-center justify-center h-full">
                                <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
                              </div>
                            )}
                          </div>
                          {/* Status badge */}
                          <div className="absolute top-1.5 left-1.5">
                            {page.status === "processed" && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-800">
                                <CheckCircle2 className="h-3 w-3" />
                                Processed
                              </span>
                            )}
                            {page.status === "processing" && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-800">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                Processing
                              </span>
                            )}
                            {page.status === "failed" && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-800">
                                <AlertCircle className="h-3 w-3" />
                                Failed
                              </span>
                            )}
                            {page.status === "unreadable" && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800">
                                <AlertCircle className="h-3 w-3" />
                                Unreadable
                              </span>
                            )}
                          </div>
                          {/* Page number */}
                          <div className="absolute bottom-1.5 right-1.5">
                            <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium bg-black/50 text-white">
                              {i + 1}
                            </span>
                          </div>
                          {/* Delete button */}
                          <button
                            onClick={() => removePage({ pageId: page._id })}
                            className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded bg-black/50 text-white hover:bg-red-600"
                          >
                            <X className="h-3 w-3" />
                          </button>
                          {/* Info overlay */}
                          {page.chapterTitle && (
                            <div className="absolute bottom-0 left-0 right-0 p-1.5 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                              <p className="text-[10px] text-white truncate">
                                {page.chapterTitle}
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
                      <p className="text-sm text-muted-foreground mb-3">
                        No pages uploaded yet
                      </p>
                      <p className="text-xs text-muted-foreground mb-4">
                        Upload photos of your textbook pages. The AI will read and organize them.
                      </p>
                      <Button
                        onClick={() => fileInputRef.current?.click()}
                        className="gap-2"
                      >
                        <Upload className="h-4 w-4" />
                        Upload Pages
                      </Button>
                    </div>
                  )}

                  {/* Process button */}
                  {bookPages && bookPages.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <Link to={`/books/${selectedBook}/organize`}>
                        <Button variant="outline" className="w-full gap-2">
                          <ChevronRight className="h-4 w-4" />
                          Organize & Analyze Pages
                        </Button>
                      </Link>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="vintage-card">
                <CardContent className="p-12 text-center">
                  <BookOpen className="h-16 w-16 mx-auto mb-4 text-muted-foreground/20" />
                  <h3 className="font-serif-vintage text-lg font-bold text-foreground mb-2">
                    Select a Book
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Choose a book from the left to view and upload pages
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
