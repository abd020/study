import { Link, useNavigate } from "react-router-dom";
import {
  BookOpenCheck, CalendarClock, GraduationCap, Layers, ListChecks, Sparkles, Target, Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { RowsSkeleton } from "@/components/common/loading";
import { useCourses } from "@/hooks/use-courses";
import { useExams } from "@/hooks/use-exams";
import { useDashboard, useWeakTopics } from "@/hooks/use-study";
import { formatCountdown, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";

const MODES = [
  {
    key: "quick",
    icon: Zap,
    title: "Révision rapide",
    description: "10 cartes prioritaires, pour une pause de cinq minutes.",
    to: "/study/flashcards?mode=quick&limit=10",
  },
  {
    key: "flashcards",
    icon: Layers,
    title: "Flashcards",
    description: "Toutes les cartes dues aujourd'hui, planifiées par la répétition espacée.",
    to: "/study/flashcards",
  },
  {
    key: "quiz",
    icon: ListChecks,
    title: "Quiz",
    description: "Teste ta compréhension avec des questions générées depuis ton cours.",
    to: "/quizzes",
  },
  {
    key: "weak",
    icon: Target,
    title: "Points faibles",
    description: "Les notions les moins maîtrisées d'abord.",
    to: "/study/flashcards?mode=weak",
  },
];

export default function StudyPage() {
  const navigate = useNavigate();
  const summary = useDashboard();
  const courses = useCourses();
  const exams = useExams({ upcomingOnly: true });
  const weakTopics = useWeakTopics(null, 6);

  const due = summary.data?.due_today ?? 0;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Réviser"
        description="Choisis un mode de révision. Tout fonctionne sans appel à l'IA : la planification est calculée localement."
      />

      <Card className={cn("border-primary/30 bg-primary/5", due === 0 && "border-border bg-card")}>
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold">
              {due > 0 ? `${pluralize(due, "carte")} à réviser aujourd'hui` : "Tout est à jour pour aujourd'hui."}
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {due > 0
                ? `${summary.data?.new_today ?? 0} nouvelle(s) · ${summary.data?.cards_learning ?? 0} en apprentissage`
                : "Prends de l'avance avec une révision par chapitre ou avant examen."}
            </p>
          </div>
          <Button disabled={due === 0} onClick={() => navigate("/study/flashcards")}>
            <Sparkles /> Démarrer la session
          </Button>
        </CardContent>
      </Card>

      <section className="grid gap-4 sm:grid-cols-2">
        {MODES.map((mode) => (
          <Link
            key={mode.key}
            to={mode.to}
            className="flex gap-4 rounded-xl border bg-card p-5 transition-shadow hover:shadow-lifted"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <mode.icon className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{mode.title}</span>
              <span className="mt-0.5 block text-sm text-muted-foreground">{mode.description}</span>
            </span>
          </Link>
        ))}
      </section>

      {/* Révision avant examen */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold tracking-tight">Révision avant examen</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          La session mélange cartes difficiles, notions jamais révisées, erreurs de quiz et points
          faibles, en se limitant aux chapitres évalués.
        </p>

        {exams.isLoading ? (
          <RowsSkeleton count={2} />
        ) : exams.data?.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {exams.data.slice(0, 4).map((exam) => (
              <Card key={exam.id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{exam.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{exam.course?.name}</p>
                  <Badge variant="secondary" className="mt-1.5">
                    <CalendarClock className="h-3 w-3" /> {formatCountdown(exam.exam_date)}
                  </Badge>
                </div>
                <Button asChild size="sm">
                  <Link to={`/study/flashcards?exam=${exam.id}`}>Réviser</Link>
                </Button>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={CalendarClock}
            title="Aucun examen planifié."
            description="Ajoute une date d'examen pour débloquer ce mode."
            action={
              <Button asChild size="sm" variant="outline">
                <Link to="/calendar">Ajouter un examen</Link>
              </Button>
            }
          />
        )}
      </section>

      {/* Révision par chapitre / par cours */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <BookOpenCheck className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold tracking-tight">Révision par cours</h2>
        </div>

        {courses.isLoading ? (
          <RowsSkeleton count={3} />
        ) : courses.data?.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {courses.data.map((course) => (
              <Card key={course.id} className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold">{course.name}</p>
                  <span className="shrink-0 text-xs text-muted-foreground">{course.progress} %</span>
                </div>
                <Progress value={course.progress} className="mt-2 h-1.5" />
                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">
                    {course.due_count > 0 ? `${course.due_count} à réviser` : "À jour"}
                  </span>
                  <Button asChild size="sm" variant="outline" disabled={course.flashcard_count === 0}>
                    <Link to={`/study/flashcards?course=${course.id}`}>Réviser</Link>
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState icon={Layers} title="Aucun cours à réviser." description="Commence par créer un cours." />
        )}
      </section>

      {/* Points faibles */}
      {weakTopics.data?.length ? (
        <section className="space-y-3">
          <Card>
            <CardHeader><CardTitle className="text-base">Notions à retravailler</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {weakTopics.data.map((topic) => (
                <div key={`${topic.course_id}-${topic.topic}`} className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate font-medium">{topic.topic}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{topic.mastery} %</span>
                    </div>
                    <Progress
                      value={topic.mastery}
                      className="mt-1.5 h-1.5"
                      indicatorClassName={
                        topic.mastery < 40 ? "bg-destructive" : topic.mastery < 70 ? "bg-warning" : "bg-success"
                      }
                    />
                    <p className="mt-1 truncate text-[11px] text-muted-foreground">
                      {topic.course_name} · {topic.cards_total} carte(s)
                      {topic.quiz_answered > 0 ? ` · ${topic.quiz_correct}/${topic.quiz_answered} au quiz` : ""}
                    </p>
                  </div>
                  <Button asChild size="sm" variant="outline" className="shrink-0">
                    <Link to={`/study/flashcards?course=${topic.course_id}&topic=${encodeURIComponent(topic.topic)}`}>
                      Réviser
                    </Link>
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      ) : null}
    </div>
  );
}
