import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { BarChart3, Clock, Flame, Layers, Target, TrendingDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/common/stat-card";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { CardsSkeleton, RowsSkeleton } from "@/components/common/loading";
import { useDashboard, useProgressOverview, useRecentSessions, useWeakTopics } from "@/hooks/use-study";
import { SESSION_TYPE_LABELS } from "@/lib/constants";
import { formatDateTime, formatDuration, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

const RANGES = [
  { value: "7", label: "7 jours" },
  { value: "30", label: "30 jours" },
  { value: "90", label: "90 jours" },
];

export default function ProgressPage() {
  const [range, setRange] = useState("30");
  const overview = useProgressOverview(Number(range));
  const summary = useDashboard();
  const weakTopics = useWeakTopics(null, 10);
  const sessions = useRecentSessions(10);

  const data = overview.data;

  const chartData = (data?.daily ?? []).map((day) => ({
    ...day,
    label: format(parseISO(day.day), "d MMM", { locale: fr }),
    minutes: Math.round(day.seconds / 60),
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Progression"
        description="Toutes ces statistiques sont calculées à partir de tes sessions réelles, sans appel à l'IA."
        actions={
          <Tabs value={range} onValueChange={setRange}>
            <TabsList>
              {RANGES.map((item) => (
                <TabsTrigger key={item.value} value={item.value}>{item.label}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        }
      />

      {overview.isError ? (
        <ErrorState error={overview.error} onRetry={() => void overview.refetch()} />
      ) : null}

      {overview.isLoading ? (
        <CardsSkeleton count={4} />
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={Clock}
            label="Temps étudié"
            value={formatDuration(data?.total_seconds ?? 0)}
            hint={`${data?.total_sessions ?? 0} session(s) au total`}
            tone="primary"
          />
          <StatCard
            icon={Layers}
            label="Cartes étudiées"
            value={data?.total_cards_reviewed ?? 0}
            hint={`${data?.cards_mastered ?? 0} maîtrisées sur ${data?.cards_total ?? 0}`}
          />
          <StatCard
            icon={Target}
            label="Score moyen aux quiz"
            value={data?.quiz_avg_score != null ? `${data.quiz_avg_score} %` : "—"}
            hint={`${data?.quiz_attempts ?? 0} tentative(s)`}
            tone="success"
          />
          <StatCard
            icon={Flame}
            label="Série de jours"
            value={`${summary.data?.streak_days ?? 0} j`}
            hint={`${summary.data?.sessions_this_week ?? 0} session(s) cette semaine`}
            tone="warning"
          />
        </section>
      )}

      {/* Activité */}
      <Card>
        <CardHeader><CardTitle className="text-base">Temps de révision</CardTitle></CardHeader>
        <CardContent>
          {overview.isLoading ? (
            <div className="h-64 animate-pulse rounded-lg bg-muted" />
          ) : (data?.total_sessions ?? 0) === 0 ? (
            <EmptyState
              icon={BarChart3}
              title="Aucune session enregistrée."
              description="Lance une première révision pour voir ta progression apparaître ici."
              action={
                <Button asChild size="sm">
                  <Link to="/study">Commencer à réviser</Link>
                </Button>
              }
              className="border-0 bg-transparent"
            />
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="minutesGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                    minTickGap={24}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={false}
                    width={38}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(value: number) => [`${value} min`, "Temps"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="minutes"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#minutesGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Performance par cours */}
        <Card>
          <CardHeader><CardTitle className="text-base">Performance par cours</CardTitle></CardHeader>
          <CardContent>
            {overview.isLoading ? (
              <RowsSkeleton count={3} />
            ) : (data?.by_course.length ?? 0) === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Aucun cours enregistré.</p>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={(data?.by_course ?? []).map((course) => ({
                      name: course.name.length > 14 ? `${course.name.slice(0, 13)}…` : course.name,
                      progression: course.progress,
                    }))}
                    margin={{ top: 6, right: 6, left: -18, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} width={38} />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      formatter={(value: number) => [`${value} %`, "Progression"]}
                      cursor={{ fill: "hsl(var(--muted))" }}
                    />
                    <Bar dataKey="progression" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Points faibles */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingDown className="h-4 w-4 text-muted-foreground" /> Points faibles
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {weakTopics.isLoading ? (
              <RowsSkeleton count={4} />
            ) : weakTopics.data?.length ? (
              weakTopics.data.map((topic) => (
                <div key={`${topic.course_id}-${topic.topic}`}>
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
                    {topic.course_name} · {topic.cards_struggling} carte(s) difficile(s) ·{" "}
                    {topic.cards_never_reviewed} jamais révisée(s) · dernière révision{" "}
                    {formatRelative(topic.last_reviewed_at)}
                  </p>
                </div>
              ))
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Pas encore assez de données pour identifier des points faibles.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Performance par chapitre */}
      <Card>
        <CardHeader><CardTitle className="text-base">Performance par chapitre</CardTitle></CardHeader>
        <CardContent>
          {overview.isLoading ? (
            <RowsSkeleton count={4} />
          ) : (data?.by_section.length ?? 0) === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Aucun chapitre enregistré.</p>
          ) : (
            <ul className="divide-y">
              {(data?.by_section ?? []).map((section) => (
                <li key={section.id} className="flex items-center gap-3 py-3">
                  <span
                    className="h-8 w-1 shrink-0 rounded-full"
                    style={{ backgroundColor: section.course_color }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium">{section.title}</p>
                      <span
                        className={cn(
                          "shrink-0 text-xs font-medium",
                          section.mastery < 40 ? "text-destructive" : section.mastery < 70 ? "text-warning" : "text-success",
                        )}
                      >
                        {section.mastery} %
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {section.course_name} · {section.cards_mastered}/{section.cards_total} cartes maîtrisées
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Sessions récentes */}
      <Card>
        <CardHeader><CardTitle className="text-base">Sessions récentes</CardTitle></CardHeader>
        <CardContent>
          {sessions.isLoading ? (
            <RowsSkeleton count={4} />
          ) : (sessions.data?.length ?? 0) === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Aucune session terminée pour l'instant.
            </p>
          ) : (
            <ul className="divide-y">
              {(sessions.data ?? []).map((session) => (
                <li key={session.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {SESSION_TYPE_LABELS[session.session_type]}
                      {session.course ? ` · ${session.course.name}` : ""}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatDateTime(session.started_at)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-medium">{formatDuration(session.duration_seconds)}</p>
                    <p className="text-xs text-muted-foreground">
                      {session.cards_reviewed > 0
                        ? `${session.cards_reviewed} carte(s)`
                        : `${session.correct_answers}/${session.questions_answered} correctes`}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
