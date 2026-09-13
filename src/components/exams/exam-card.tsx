import { Link } from "react-router-dom";
import { CalendarClock, MapPin, MoreHorizontal, Pencil, Sparkles, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useExamReadiness } from "@/hooks/use-exams";
import { EXAM_TYPE_LABELS } from "@/lib/constants";
import { formatCountdown, formatDate } from "@/lib/format";
import type { ExamWithCourse } from "@/types/database";
import { cn } from "@/lib/utils";

function readinessTone(value: number): string {
  if (value >= 75) return "bg-success";
  if (value >= 45) return "bg-warning";
  return "bg-destructive";
}

export function ExamCard({
  exam,
  onEdit,
  onDelete,
  compact = false,
}: {
  exam: ExamWithCourse;
  onEdit?: (exam: ExamWithCourse) => void;
  onDelete?: (exam: ExamWithCourse) => void;
  compact?: boolean;
}) {
  const { data: readiness, isLoading } = useExamReadiness(exam.id);
  const days = readiness?.days_remaining ?? null;
  const value = readiness?.readiness ?? 0;

  return (
    <Card className={cn("p-4", compact && "p-3.5")}>
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 h-9 w-1 shrink-0 rounded-full"
          style={{ backgroundColor: exam.course?.color ?? "#4f46e5" }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{exam.title}</p>
              <p className="truncate text-xs text-muted-foreground">
                {exam.course?.name ?? "Cours"} · {EXAM_TYPE_LABELS[exam.exam_type]}
              </p>
            </div>

            {onEdit || onDelete ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Actions de l'examen">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {onEdit ? (
                    <DropdownMenuItem onSelect={() => onEdit(exam)}>
                      <Pencil /> Modifier
                    </DropdownMenuItem>
                  ) : null}
                  {onDelete ? (
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onSelect={() => onDelete(exam)}
                    >
                      <Trash2 /> Supprimer
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge variant={days !== null && days <= 3 ? "destructive" : "secondary"}>
              <CalendarClock className="h-3 w-3" /> {formatCountdown(exam.exam_date)}
            </Badge>
            <Badge variant="outline">{formatDate(exam.exam_date)}</Badge>
            {exam.location ? (
              <Badge variant="outline"><MapPin className="h-3 w-3" /> {exam.location}</Badge>
            ) : null}
          </div>

          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Préparation estimée</span>
              <span className="font-medium">{isLoading ? "…" : `${value} %`}</span>
            </div>
            <Progress value={value} indicatorClassName={readinessTone(value)} />
          </div>

          {!compact ? (
            <div className="mt-3 flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                {readiness
                  ? `${readiness.cards_mastered}/${readiness.cards_total} cartes maîtrisées · ${readiness.weak_topics} notion(s) faible(s)`
                  : "Calcul en cours…"}
              </p>
              <Button asChild size="sm" variant="outline">
                <Link to={`/study/flashcards?exam=${exam.id}`}>
                  <Sparkles /> Réviser
                </Link>
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
