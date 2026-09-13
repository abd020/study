import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BookOpen, CalendarDays, FileText, Layers, ListChecks, Loader2, Search, SquareStack,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useSearch } from "@/hooks/use-account";
import type { SearchResult } from "@/types/database";
import { cn } from "@/lib/utils";

const KIND_META: Record<SearchResult["kind"], { label: string; icon: typeof BookOpen }> = {
  course: { label: "Cours", icon: BookOpen },
  section: { label: "Chapitre", icon: SquareStack },
  flashcard: { label: "Flashcard", icon: Layers },
  summary: { label: "Résumé", icon: FileText },
  material: { label: "Contenu", icon: FileText },
  exam: { label: "Examen", icon: CalendarDays },
  quiz: { label: "Quiz", icon: ListChecks },
};

function routeFor(result: SearchResult): string {
  switch (result.kind) {
    case "quiz":
      return `/quizzes/${result.id}`;
    case "exam":
      return `/calendar?exam=${result.id}`;
    case "flashcard":
      return `/courses/${result.course_id}?tab=flashcards`;
    case "summary":
      return `/courses/${result.course_id}?tab=summaries`;
    case "material":
      return `/courses/${result.course_id}?tab=content`;
    case "section":
      return `/courses/${result.course_id}?tab=sections`;
    default:
      return `/courses/${result.course_id}`;
  }
}

export function SearchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const navigate = useNavigate();
  const { data, isFetching } = useSearch(debounced);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), 220);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const grouped = useMemo(() => {
    const groups = new Map<SearchResult["kind"], SearchResult[]>();
    for (const result of data ?? []) {
      const list = groups.get(result.kind) ?? [];
      list.push(result);
      groups.set(result.kind, list);
    }
    return [...groups.entries()];
  }, [data]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[12%] max-w-xl translate-y-0 gap-0 p-0">
        <DialogTitle className="sr-only">Recherche globale</DialogTitle>
        <DialogDescription className="sr-only">
          Rechercher un cours, un chapitre, une flashcard, un résumé, un quiz ou un examen.
        </DialogDescription>

        <div className="flex items-center gap-2 border-b px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher un cours, un chapitre, une notion…"
            className="h-8 border-0 px-0 shadow-none focus-visible:ring-0"
          />
          {isFetching ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
        </div>

        <div className="max-h-[55vh] overflow-y-auto p-2 scrollbar-thin">
          {debounced.trim().length < 2 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              Tape au moins deux caractères pour lancer la recherche.
            </p>
          ) : grouped.length === 0 && !isFetching ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              Aucun résultat pour « {debounced} ».
            </p>
          ) : (
            grouped.map(([kind, results]) => {
              const meta = KIND_META[kind];
              return (
                <div key={kind} className="mb-2">
                  <p className="px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {meta.label}
                  </p>
                  {results.map((result) => (
                    <button
                      key={`${result.kind}-${result.id}`}
                      type="button"
                      onClick={() => {
                        onOpenChange(false);
                        navigate(routeFor(result));
                      }}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-accent",
                      )}
                    >
                      <span
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
                        style={{ backgroundColor: `${result.course_color}1a`, color: result.course_color }}
                      >
                        <meta.icon className="h-3.5 w-3.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{result.title}</span>
                        {result.subtitle ? (
                          <span className="block truncate text-xs text-muted-foreground">{result.subtitle}</span>
                        ) : null}
                      </span>
                    </button>
                  ))}
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
