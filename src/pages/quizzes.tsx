import { useState } from "react";
import { Link } from "react-router-dom";
import { History, ListChecks, Play, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { RowsSkeleton } from "@/components/common/loading";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { useDeleteQuiz, useQuizAttempts, useQuizzes } from "@/hooks/use-quizzes";
import { DIFFICULTY_LABELS } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function QuizzesPage() {
  const quizzes = useQuizzes();
  const attempts = useQuizAttempts();
  const deleteQuiz = useDeleteQuiz();
  const [deleting, setDeleting] = useState<{ id: string; title: string } | null>(null);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quiz"
        description="Génère des quiz depuis un cours, puis suis tes résultats pour repérer les notions fragiles."
      />

      <Tabs defaultValue="quizzes">
        <TabsList>
          <TabsTrigger value="quizzes">Mes quiz</TabsTrigger>
          <TabsTrigger value="history">Historique</TabsTrigger>
        </TabsList>

        <TabsContent value="quizzes">
          {quizzes.isLoading ? (
            <RowsSkeleton count={4} />
          ) : (quizzes.data?.length ?? 0) === 0 ? (
            <EmptyState
              icon={ListChecks}
              title="Aucun quiz pour le moment."
              description="Ouvre un cours et lance « Générer un quiz » à partir de ton contenu."
              action={
                <Button asChild>
                  <Link to="/courses">Voir mes cours</Link>
                </Button>
              }
            />
          ) : (
            <div className="space-y-2">
              {(quizzes.data ?? []).map((quiz) => (
                <Card key={quiz.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="truncate text-sm font-semibold">{quiz.title}</p>
                      {quiz.created_by === "claude" ? <Badge>Claude</Badge> : null}
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {[quiz.course_name, quiz.section_title].filter(Boolean).join(" · ")}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge variant="secondary">{quiz.question_count} questions</Badge>
                      <Badge variant="outline">{DIFFICULTY_LABELS[quiz.difficulty]}</Badge>
                      {quiz.best_score != null ? (
                        <Badge
                          variant={quiz.best_score >= 70 ? "success" : quiz.best_score >= 50 ? "warning" : "destructive"}
                        >
                          Meilleur : {quiz.best_score} %
                        </Badge>
                      ) : null}
                      {quiz.attempt_count > 0 ? (
                        <Badge variant="outline">{quiz.attempt_count} tentative(s)</Badge>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex shrink-0 gap-2">
                    <Button asChild size="sm">
                      <Link to={`/quizzes/${quiz.id}`}><Play /> Lancer</Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      aria-label="Supprimer le quiz"
                      onClick={() => setDeleting({ id: quiz.id, title: quiz.title })}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <History className="h-4 w-4 text-muted-foreground" /> Tentatives récentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              {attempts.isLoading ? (
                <RowsSkeleton count={4} />
              ) : (attempts.data?.length ?? 0) === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Aucune tentative enregistrée pour l'instant.
                </p>
              ) : (
                <ul className="divide-y">
                  {(attempts.data ?? []).map((attempt) => {
                    const score = attempt.total_questions
                      ? Math.round((attempt.score * 100) / attempt.total_questions)
                      : 0;
                    return (
                      <li key={attempt.id} className="flex items-center justify-between gap-3 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{attempt.quiz?.title ?? "Quiz supprimé"}</p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {attempt.quiz?.course?.name} · {formatDateTime(attempt.completed_at)}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "shrink-0 text-sm font-semibold",
                            score >= 70 ? "text-success" : score >= 50 ? "text-warning" : "text-destructive",
                          )}
                        >
                          {attempt.score}/{attempt.total_questions}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Supprimer « ${deleting?.title} » ?`}
        description="Les questions et l'historique des tentatives seront supprimés."
        confirmLabel="Supprimer"
        destructive
        onConfirm={() => {
          if (deleting) deleteQuiz.mutate(deleting.id);
          setDeleting(null);
        }}
      />
    </div>
  );
}
