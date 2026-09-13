import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Eye, Layers, Lightbulb, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { SessionSummary } from "@/components/study/session-summary";
import { useRecordReview } from "@/hooks/use-flashcards";
import { useEndSession, useStartSession } from "@/hooks/use-study";
import { getProgressFor } from "@/services/flashcards";
import { previewInterval, REVIEW_GRADES, type ReviewGrade, type SchedulingState } from "@/lib/sm2";
import { DIFFICULTY_LABELS } from "@/lib/constants";
import type { SessionType, StudyCard } from "@/types/database";
import { cn } from "@/lib/utils";

interface FlashcardPlayerProps {
  cards: StudyCard[];
  sessionType: SessionType;
  courseId?: string | null;
  examId?: string | null;
  title: string;
  subtitle?: string;
  onExit: () => void;
}

const GRADE_STYLES: Record<ReviewGrade, string> = {
  again: "border-destructive/40 text-destructive hover:bg-destructive/10",
  hard: "border-warning/40 text-warning hover:bg-warning/10",
  good: "border-primary/40 text-primary hover:bg-primary/10",
  easy: "border-success/40 text-success hover:bg-success/10",
};

export function FlashcardPlayer({
  cards, sessionType, courseId, examId, title, subtitle, onExit,
}: FlashcardPlayerProps) {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [finished, setFinished] = useState(false);
  const [tally, setTally] = useState({ again: 0, hard: 0, good: 0, easy: 0 });
  const [elapsed, setElapsed] = useState(0);

  const startedAt = useRef(Date.now());
  const sessionId = useRef<string | null>(null);
  const startSession = useStartSession();
  const endSession = useEndSession();
  const recordReview = useRecordReview();

  // État SM-2 courant de chaque carte (nécessaire pour calculer le prochain intervalle).
  const cardIds = useMemo(() => cards.map((card) => card.id), [cards]);
  const { data: progressMap } = useQuery({
    queryKey: ["flashcard-progress", cardIds.join(",")],
    queryFn: () => getProgressFor(cardIds),
    enabled: cardIds.length > 0,
  });

  const current = cards[index];
  const total = cards.length;

  // Démarrage de la session (une seule fois).
  useEffect(() => {
    if (sessionId.current || cards.length === 0) return;
    let cancelled = false;
    void startSession
      .mutateAsync({ sessionType, courseId, examId })
      .then((session) => {
        if (!cancelled) sessionId.current = session.id;
      })
      .catch(() => {
        /* la session est un confort de suivi : ne bloque jamais la révision */
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards.length]);

  // Chronomètre de session.
  useEffect(() => {
    if (finished) return;
    const timer = setInterval(() => setElapsed(Math.round((Date.now() - startedAt.current) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [finished]);

  const reviewed = tally.again + tally.hard + tally.good + tally.easy;

  const finish = useCallback(
    (stats: typeof tally) => {
      setFinished(true);
      const done = stats.again + stats.hard + stats.good + stats.easy;
      if (sessionId.current) {
        endSession.mutate({
          sessionId: sessionId.current,
          durationSeconds: Math.round((Date.now() - startedAt.current) / 1000),
          cardsReviewed: done,
          questionsAnswered: done,
          correctAnswers: stats.good + stats.easy,
        });
      }
    },
    [endSession],
  );

  const grade = useCallback(
    (value: ReviewGrade) => {
      if (!current) return;

      const stored = progressMap?.get(current.id);
      const state: SchedulingState | null = stored
        ? {
            repetitions: stored.repetitions,
            ease_factor: Number(stored.ease_factor),
            interval_days: Number(stored.interval_days),
            status: stored.status,
            correct_count: stored.correct_count,
            incorrect_count: stored.incorrect_count,
            lapses: stored.lapses,
          }
        : null;

      recordReview.mutate({ cardId: current.id, grade: value, current: state });

      const nextTally = { ...tally, [value]: tally[value] + 1 };
      setTally(nextTally);
      setRevealed(false);

      if (index + 1 >= total) {
        finish(nextTally);
      } else {
        setIndex(index + 1);
      }
    },
    [current, index, total, tally, progressMap, recordReview, finish],
  );

  // Raccourcis clavier : Espace pour révéler, 1-4 pour noter.
  useEffect(() => {
    if (finished) return;
    const handler = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.code === "Space" || event.key === "Enter") {
        event.preventDefault();
        if (!revealed) setRevealed(true);
        return;
      }
      if (!revealed) return;
      const map: Record<string, ReviewGrade> = { "1": "again", "2": "hard", "3": "good", "4": "easy" };
      const value = map[event.key];
      if (value) {
        event.preventDefault();
        grade(value);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [revealed, finished, grade]);

  if (finished) {
    return (
      <SessionSummary
        tally={tally}
        durationSeconds={elapsed}
        total={total}
        onExit={onExit}
      />
    );
  }

  if (!current) return null;

  const stored = progressMap?.get(current.id);
  const state: SchedulingState = stored
    ? {
        repetitions: stored.repetitions,
        ease_factor: Number(stored.ease_factor),
        interval_days: Number(stored.interval_days),
        status: stored.status,
        correct_count: stored.correct_count,
        incorrect_count: stored.incorrect_count,
        lapses: stored.lapses,
      }
    : {
        repetitions: 0, ease_factor: 2.5, interval_days: 0, status: "new",
        correct_count: 0, incorrect_count: 0, lapses: 0,
      };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col">
      {/* En-tête de session */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold tracking-tight">{title}</h1>
          <p className="truncate text-sm text-muted-foreground">
            {subtitle ?? `${current.course_name}${current.section_title ? ` · ${current.section_title}` : ""}`}
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={onExit} aria-label="Quitter la session">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
          <span>Carte {index + 1} / {total}</span>
          <span>{reviewed} révisée{reviewed > 1 ? "s" : ""}</span>
        </div>
        <Progress value={(index / total) * 100} />
      </div>

      {/* Carte */}
      <Card className="mt-6 flex min-h-[320px] flex-col p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline" style={{ color: current.course_color, borderColor: `${current.course_color}55` }}>
            {current.course_name}
          </Badge>
          {current.section_title ? <Badge variant="secondary">{current.section_title}</Badge> : null}
          {current.topic ? <Badge variant="secondary">{current.topic}</Badge> : null}
          <Badge variant="outline">{DIFFICULTY_LABELS[current.difficulty]}</Badge>
          {current.reason ? <Badge variant="warning">{current.reason}</Badge> : null}
          {current.status === "new" ? <Badge>Nouvelle</Badge> : null}
        </div>

        <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
          <p className="text-balance text-xl font-medium leading-relaxed sm:text-2xl">
            {current.question}
          </p>

          {revealed ? (
            <div className="mt-7 w-full animate-flip-in border-t pt-6">
              <p className="text-balance text-lg leading-relaxed">{current.answer}</p>
              {current.explanation ? (
                <div className="mx-auto mt-4 flex max-w-xl items-start gap-2 rounded-lg bg-muted px-4 py-3 text-left">
                  <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <p className="text-sm leading-relaxed text-muted-foreground">{current.explanation}</p>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </Card>

      {/* Actions */}
      <div className="mt-5">
        {revealed ? (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {REVIEW_GRADES.map((item, position) => (
              <button
                key={item.grade}
                type="button"
                onClick={() => grade(item.grade)}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-lg border-2 bg-background px-3 py-3 transition-colors",
                  GRADE_STYLES[item.grade],
                )}
              >
                <span className="text-sm font-semibold">{item.label}</span>
                <span className="text-[11px] opacity-70">{previewInterval(state, item.grade)}</span>
                <span className="hidden text-[10px] opacity-50 sm:block">Touche {position + 1}</span>
              </button>
            ))}
          </div>
        ) : (
          <Button className="w-full" size="lg" onClick={() => setRevealed(true)}>
            <Eye /> Afficher la réponse
          </Button>
        )}

        <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <Layers className="h-3.5 w-3.5" />
          Espace pour révéler, 1 à 4 pour noter.
        </p>
      </div>
    </div>
  );
}
