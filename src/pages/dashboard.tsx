import { Link } from "react-router-dom";
import {
  ArrowRight, BookOpen, CalendarClock, Clock, Flame, Layers, Plus, Sparkles, Target, TrendingDown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CourseCard } from "@/components/courses/course-card";
import { CardsSkeleton, RowsSkeleton } from "@/components/common/loading";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { ExamCard } from "@/components/exams/exam-card";
import { useCourses } from "@/hooks/use-courses";
import { useExams } from "@/hooks/use-exams";
import { useAuth } from "@/hooks/use-auth";
import { useDashboard, useWeakTopics } from "@/hooks/use-study";
import { daysUntil, formatCountdown, formatDate, formatDuration, pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  const { profile, user } = useAuth();
  const summary = useDashboard();
  const courses = useCourses();
  const exams = useExams({ upcomingOnly: true });
  const weakTopics = useWeakTopics(null, 5);

  const firstName = profile?.first_name?.trim() || user?.email?.split("@")[0] || "";
  const data = summary.data;

  // Cours nécessitant le plus d'attention : examen proche et progression faible.
  const needsAttention = (courses.data ?? [])
    .map((course) => {
      const days = daysUntil(course.next_exam_date);
      const urgency = days === null ? 0 : Math.max(0, 40 - days);
      return { course, score: (100 - course.progress) + urgency + course.due_count, days };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Bonjour {firstName || "à toi"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data?.due_today
              ? `${pluralize(data.due_today, "carte")} t'attendent aujourd'hui.`
              : "Rien d'urgent aujourd'hui — bon moment pour prendre de l'avance."}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/courses"><Plus /> Nouveau cours</Link>
          </Button>
          <Button asChild>
            <Link to="/study/flashcards"><Sparkles /> Réviser maintenant</Link>
          </Button>
        </div>
      </header>

      {summary.isError ? (
        <ErrorState error={summary.error} onRetry={() => void summary.refetch()} />
      ) : null}

      {/* Indicateurs */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={CalendarClock}
          label="Prochain examen"
          value={data?.next_exam ? formatCountdown(data.next_exam.exam_date) : "Aucun"}
          hint={
            data?.next_exam
              ? `${data.next_exam.course_name} · ${formatDate(data.next_exam.exam_date)}`
              : "Ajoute une date depuis un cours"
          }
          tone={data?.next_exam && data.next_exam.days_remaining <= 3 ? "destructive" : "primary"}
          loading={summary.isLoading}
        />
        <MetricCard
          icon={Layers}
          label="À réviser aujourd'hui"
          value={data?.due_today ?? 0}
          hint={data?.new_today ? `dont ${data.new_today} nouvelle(s)` : "Tout est à jour"}
          tone="warning"
          loading={summary.isLoading}
        />
        <MetricCard
          icon={Clock}
          label="Cette semaine"
          value={formatDuration(data?.seconds_this_week ?? 0)}
          hint={`${data?.sessions_this_week ?? 0} session(s) · ${data?.cards_this_week ?? 0} cartes`}
          loading={summary.isLoading}
        />
        <MetricCard
          icon={Flame}
          label="Série en cours"
          value={`${data?.streak_days ?? 0} j`}
          hint={data?.streak_days ? "Continue comme ça." : "Révise aujourd'hui pour la lancer."}
          tone="success"
          loading={summary.isLoading}
        />
      </section>

      {/* Progression globale */}
      <Card>
        <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="font-medium">Progression globale</span>
              <span className="text-muted-foreground">{data?.global_progress ?? 0} %</span>
            </div>
            <Progress value={data?.global_progress ?? 0} />
            <p className="mt-2 text-xs text-muted-foreground">
              {data?.cards_mastered ?? 0} cartes maîtrisées sur {data?.cards_total ?? 0} ·{" "}
              {data?.cards_learning ?? 0} en apprentissage
            </p>
          </div>
          <Button asChild variant="outline" size="sm" className="shrink-0">
            <Link to="/progress">Voir le détail <ArrowRight /></Link>
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* À réviser aujourd'hui */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">À réviser aujourd'hui</CardTitle>
            {data?.due_today ? (
              <Button asChild size="sm">
                <Link to="/study/flashcards">Démarrer</Link>
              </Button>
            ) : null}
          </CardHeader>
          <CardContent>
            {summary.isLoading ? (
              <RowsSkeleton count={2} />
            ) : data?.due_today ? (
              <div className="space-y-3">
                <div className="rounded-lg border bg-muted/40 p-4">
                  <p className="text-sm">
                    <span className="text-2xl font-semibold">{data.due_today}</span>{" "}
                    <span className="text-muted-foreground">
                      carte{data.due_today > 1 ? "s" : ""} planifiée{data.due_today > 1 ? "s" : ""} par la répétition espacée
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {data.cards_learning} en apprentissage · {data.new_today} jamais vue(s)
                  </p>
                </div>
                {data.cards_today > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Déjà {data.cards_today} carte(s) revue(s) aujourd'hui ({formatDuration(data.seconds_today)}).
                  </p>
                ) : null}
              </div>
            ) : (
              <EmptyState
                icon={Target}
                title="Tout est à jour pour aujourd'hui."
                description="Reviens demain, ou prends de l'avance avec une révision par chapitre."
                action={
                  <Button asChild variant="outline" size="sm">
                    <Link to="/study">Explorer les modes de révision</Link>
                  </Button>
                }
                className="border-0 bg-transparent py-8"
              />
            )}
          </CardContent>
        </Card>

        {/* Points faibles */}
        <Card>
          <CardHeader className="space-y-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingDown className="h-4 w-4 text-muted-foreground" /> Points faibles
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {weakTopics.isLoading ? (
              <RowsSkeleton count={3} />
            ) : weakTopics.data?.length ? (
              <>
                {weakTopics.data.map((topic) => (
                  <div key={`${topic.course_id}-${topic.topic}`} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate font-medium">{topic.topic}</span>
                      <span
                        className={cn(
                          "shrink-0 text-xs font-medium",
                          topic.mastery < 40 ? "text-destructive" : topic.mastery < 70 ? "text-warning" : "text-success",
                        )}
                      >
                        {topic.mastery} %
                      </span>
                    </div>
                    <Progress
                      value={topic.mastery}
                      className="h-1.5"
                      indicatorClassName={
                        topic.mastery < 40 ? "bg-destructive" : topic.mastery < 70 ? "bg-warning" : "bg-success"
                      }
                    />
                    <p className="truncate text-[11px] text-muted-foreground">{topic.course_name}</p>
                  </div>
                ))}
                <Button asChild size="sm" className="mt-2 w-full">
                  <Link to="/study/flashcards?mode=weak">Réviser maintenant</Link>
                </Button>
              </>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Pas encore assez de données. Révise quelques cartes pour identifier tes points faibles.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Examens à venir */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Examens à venir</h2>
          <Button asChild variant="ghost" size="sm">
            <Link to="/calendar">Calendrier <ArrowRight /></Link>
          </Button>
        </div>

        {exams.isLoading ? (
          <RowsSkeleton count={2} />
        ) : exams.data?.length ? (
          <div className="grid gap-3 lg:grid-cols-2">
            {exams.data.slice(0, 4).map((exam) => <ExamCard key={exam.id} exam={exam} />)}
          </div>
        ) : (
          <EmptyState
            icon={CalendarClock}
            title="Aucun examen enregistré."
            description="Ajoute une date d'examen depuis la page d'un cours pour activer le compte à rebours et la révision ciblée."
            action={
              <Button asChild size="sm" variant="outline">
                <Link to="/calendar">Ajouter un examen</Link>
              </Button>
            }
          />
        )}
      </section>

      {/* Cours nécessitant le plus d'attention */}
      {needsAttention.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold tracking-tight">Cours à surveiller</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {needsAttention.map(({ course, days }) => (
              <Link
                key={course.id}
                to={`/courses/${course.id}`}
                className="rounded-xl border bg-card p-4 transition-shadow hover:shadow-lifted"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold">{course.name}</p>
                  <span className="text-xs text-muted-foreground">{course.progress} %</span>
                </div>
                <Progress value={course.progress} className="mt-2 h-1.5" />
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {course.due_count > 0 ? (
                    <Badge variant="warning">{course.due_count} à réviser</Badge>
                  ) : null}
                  {days !== null ? (
                    <Badge variant={days <= 7 ? "destructive" : "secondary"}>Examen dans {days} j</Badge>
                  ) : null}
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {/* Mes cours */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight">Mes cours</h2>
          <Button asChild variant="ghost" size="sm">
            <Link to="/courses">Tout voir <ArrowRight /></Link>
          </Button>
        </div>

        {courses.isLoading ? (
          <CardsSkeleton />
        ) : courses.data?.length ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {courses.data.slice(0, 6).map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={BookOpen}
            title="Aucun cours pour le moment."
            description="Crée ton premier cours, ajoute tes chapitres et ton contenu : tout le reste en découle."
            action={
              <Button asChild>
                <Link to="/courses"><Plus /> Ajouter mon premier cours</Link>
              </Button>
            }
          />
        )}
      </section>
    </div>
  );
}

function MetricCard({
  icon: Icon, label, value, hint, tone = "default", loading,
}: {
  icon: typeof Clock;
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: "default" | "primary" | "success" | "warning" | "destructive";
  loading?: boolean;
}) {
  const tones = {
    default: "bg-secondary text-secondary-foreground",
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/15 text-warning",
    destructive: "bg-destructive/10 text-destructive",
  };

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-2 truncate text-xl font-semibold tracking-tight">
            {loading ? "…" : value}
          </p>
          {hint ? <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p> : null}
        </div>
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", tones[tone])}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </Card>
  );
}
