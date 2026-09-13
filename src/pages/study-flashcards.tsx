import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Layers, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { LoadingScreen } from "@/components/common/loading";
import { FlashcardPlayer } from "@/components/study/flashcard-player";
import { useDueCards, useExamSessionCards } from "@/hooks/use-flashcards";
import { useExam } from "@/hooks/use-exams";
import { useWeakTopics } from "@/hooks/use-study";
import { useSettings } from "@/hooks/use-account";
import type { SessionType, StudyCard } from "@/types/database";

/**
 * Session de flashcards. Le mode est piloté par l'URL :
 *   ?course=<id>            révision d'un cours
 *   ?topic=<notion>         révision d'une notion précise
 *   ?exam=<id>              révision avant examen (session construite en base)
 *   ?mode=weak              points faibles
 *   ?mode=quick&limit=10    révision rapide
 */
export default function FlashcardsSessionPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const courseId = searchParams.get("course");
  const examId = searchParams.get("exam");
  const topic = searchParams.get("topic");
  const mode = searchParams.get("mode");
  const limitParam = Number(searchParams.get("limit"));

  const settings = useSettings();
  const limit = Number.isFinite(limitParam) && limitParam > 0
    ? limitParam
    : settings.data?.cards_per_session ?? 20;

  const examQuery = useExam(examId ?? undefined);
  const examCards = useExamSessionCards(examId ?? undefined, limit);
  const weakTopics = useWeakTopics(courseId, 20);

  const dueCards = useDueCards({
    courseId,
    limit: mode === "weak" ? 200 : limit,
    includeNew: mode !== "quick",
    enabled: !examId,
  });

  const sessionType: SessionType = examId
    ? "exam_prep"
    : mode === "weak"
    ? "weak_topics"
    : mode === "quick"
    ? "quick_review"
    : courseId
    ? "section_review"
    : "flashcards";

  const cards: StudyCard[] = useMemo(() => {
    if (examId) return examCards.data ?? [];

    let list = dueCards.data ?? [];

    if (topic) {
      list = list.filter((card) => card.topic === topic);
    } else if (mode === "weak") {
      const weakSet = new Set(
        (weakTopics.data ?? []).filter((item) => item.mastery < 70).map((item) => item.topic),
      );
      const filtered = list.filter(
        (card) => (card.topic && weakSet.has(card.topic)) || card.status === "lapsed" || card.status === "learning",
      );
      list = filtered.length > 0 ? filtered : list;
    }

    return list.slice(0, limit);
  }, [examId, examCards.data, dueCards.data, topic, mode, weakTopics.data, limit]);

  const loading = examId
    ? examCards.isLoading || examQuery.isLoading
    : dueCards.isLoading || settings.isLoading;

  const error = examId ? examCards.error : dueCards.error;

  if (loading) return <LoadingScreen label="Préparation de la session…" />;
  if (error) {
    return (
      <ErrorState
        error={error}
        onRetry={() => void (examId ? examCards.refetch() : dueCards.refetch())}
      />
    );
  }

  if (cards.length === 0) {
    return (
      <EmptyState
        icon={PartyPopper}
        title={
          examId
            ? "Aucune carte à réviser pour cet examen."
            : topic
            ? `Aucune carte due pour « ${topic} ».`
            : "Tout est à jour pour aujourd'hui."
        }
        description={
          examId
            ? "Génère des flashcards sur les chapitres évalués pour préparer cette session."
            : "Reviens plus tard, ou génère de nouvelles cartes depuis un cours."
        }
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button variant="outline" onClick={() => navigate("/study")}>Modes de révision</Button>
            <Button onClick={() => navigate("/courses")}>
              <Layers /> Voir mes cours
            </Button>
          </div>
        }
        className="mt-8"
      />
    );
  }

  const title = examId
    ? `Révision avant examen${examQuery.data ? ` — ${examQuery.data.title}` : ""}`
    : mode === "weak"
    ? "Révision des points faibles"
    : mode === "quick"
    ? "Révision rapide"
    : topic
    ? `Révision — ${topic}`
    : "Session de flashcards";

  return (
    <FlashcardPlayer
      cards={cards}
      sessionType={sessionType}
      courseId={courseId ?? examQuery.data?.course_id ?? null}
      examId={examId}
      title={title}
      onExit={() => navigate("/study")}
    />
  );
}
