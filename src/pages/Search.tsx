import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search as SearchIcon, BookOpen, Brain, Calculator, ChevronRight } from "lucide-react";
import { Link } from "react-router";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const allLessons = useQuery(api.lessons.listUserLessons);

  const searchResults = query.trim()
    ? (allLessons ?? []).filter((lesson) => {
        const q = query.toLowerCase();
        return (
          lesson.title.toLowerCase().includes(q) ||
          (lesson.summary && lesson.summary.toLowerCase().includes(q)) ||
          (lesson.keyTerms && lesson.keyTerms.toLowerCase().includes(q)) ||
          (lesson.formulas && lesson.formulas.toLowerCase().includes(q))
        );
      })
    : [];

  return (
    <AppLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto">
        <h1 className="font-serif-vintage text-2xl sm:text-3xl font-bold text-foreground mb-2">
          Search
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          Search lessons, topics, terms, and formulas
        </p>

        {/* Search Input */}
        <div className="relative mb-6">
          <SearchIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for a topic, term, or formula..."
            className="pl-9"
            autoFocus
          />
        </div>

        {/* Results */}
        {query.trim() ? (
          <div className="space-y-3">
            {searchResults.length > 0 ? (
              searchResults.map((lesson) => (
                <Link key={lesson._id} to={`/study/${lesson._id}`}>
                  <div className="vintage-card p-4 flex items-center justify-between hover:border-primary/30 transition-all cursor-pointer group">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <BookOpen className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-medium text-sm text-foreground group-hover:text-primary transition-colors">
                          {lesson.title}
                        </h3>
                        {lesson.summary && (
                          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                            {lesson.summary.slice(0, 80)}
                          </p>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                  </div>
                </Link>
              ))
            ) : (
              <div className="text-center py-12 text-sm text-muted-foreground">
                <SearchIcon className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p>No results found for "{query}"</p>
                <p className="text-xs mt-1">Try different keywords or upload more textbook pages</p>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12 text-sm text-muted-foreground">
            <Brain className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="font-serif-vintage font-bold text-foreground mb-1">
              What are you looking for?
            </p>
            <p>Search by lesson name, topic, term, or formula</p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
