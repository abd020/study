import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, CheckCircle2, Lightbulb, Trophy, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ErrorState } from "@/components/common/error-state";
import { LoadingScreen } from "@/components/common/loading";
import { useQuiz } from "@/hooks/use-quizzes";
import { useAuth } from "@/hooks/use-auth";
import { useEndSession, useStartSession } from "@/hooks/use-study";
import { checkAnswer, completeAttempt, saveAnswer, startAttempt } from "@/services/quizzes";
import { QUESTION_TYPE_LABELS } from "@/lib/constants";
import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { QuizQuestion } from "@/types/database";

interface AnswerRecord {
  questionId: string;
  userAnswer: string;
  isCorrect: boolean;
}

export default function QuizPlayerPage() {
  const { quizId = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, isLoading, isError, error, refetch } = useQuiz(quizId);

  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [answers, setAnswers] = useState<AnswerRecord[]>([]);
  const [finished, setFinished] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const attemptId = useRef<string | null>(null);
  const sessionId = useRef<string | null>(null);
  const startedAt = useRef(Date.now());
  const startSession = useStartSession();
  const endSession = useEndSession();

  const questions = useMemo(() => data?.questions ?? [], [data?.questions]);
  const current: QuizQuestion | undefined = questions[index];
  const correctCount = answers.filter((a) => a.isCorrect).length;

  // Création de la tentative et de la session au démarrage.
  useEffect(() => {
    if (!user || questions.length === 0 || attemptId.current) return;
    let cancelled = false;

    void startAttempt(user.id, quizId, questions.length)
      .then((attempt) => {
        if (!cancelled) attemptId.current = attempt.id;
      })
      .catch(() => {
        /* l'historique est optionnel : le quiz reste jouable */
      });

    void startSession
      .mutateAsync({ sessionType: "quiz", courseId: data?.quiz.course_id ?? null })
      .then((session) => {
        if (!cancelled) sessionId.current = session.id;
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, questions.length, quizId]);

  useEffect(() => {
    if (finished) return;
    const timer = setInterval(() => setElapsed(Math.round((Date.now() - startedAt.current) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [finished]);

  const submit = useCallback(() => {
    if (!current || submitted || !selected.trim()) return;
    const isCorrect = checkAnswer(current, selected);
    setSubmitted(true);
    setAnswers((previous) => [...previous, { questionId: current.id, userAnswer: selected, isCorrect }]);

    if (attemptId.current) {
      void saveAnswer({
        attemptId: attemptId.current,
        questionId: current.id,
        userAnswer: selected,
        isCorrect,
      }).catch(() => {});
    }
  }, [current, selected, submitted]);

  function next() {
    if (index + 1 >= questions.length) {
      setFinished(true);
      const score = answers.filter((a) => a.isCorrect).length;
      if (attemptId.current) void completeAttempt(attemptId.current, score).catch(() => {});
      if (sessionId.current) {
        endSession.mutate({
          sessionId: sessionId.current,
          durationSeconds: Math.round((Date.now() - startedAt.current) / 1000),
          questionsAnswered: questions.length,
          correctAnswers: score,
        });
      }
      return;
    }
    setIndex(index + 1);
    setSelected("");
    setSubmitted(false);
  }

  if (isLoading) return <LoadingScreen label="Chargement du quiz…" />;
  if (isError || !data) return <ErrorState error={error} onRetry={() => void refetch()} />;

  if (questions.length === 0) {
    return (
      <ErrorState
        error={new Error("Ce quiz ne contient aucune question.")}
        title="Quiz vide"
      />
    );
  }

  if (finished) {
    const score = answers.filter((a) => a.isCorrect).length;
    const percentage = Math.round((score * 100) / questions.length);

    return (
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <Card className="p-8 text-center">
          <div
            className={cn(
              "mx-auto flex h-12 w-12 items-center justify-center rounded-xl",
              percentage >= 70 ? "bg-success/10 text-success" : percentage >= 50 ? "bg-warning/10 text-warning" : "bg-destructive/10 text-destructive",
            )}
          >
            <Trophy className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-xl font-semibold tracking-tight">Quiz terminé</h2>
          <p className="mt-1 text-3xl font-semibold">{score} / {questions.length}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {percentage} % de bonnes réponses · {formatDuration(elapsed)}
          </p>

          <div className="mt-7 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button onClick={() => navigate("/quizzes")}>Retour aux quiz</Button>
            <Button variant="outline" onClick={() => window.location.reload()}>Refaire le quiz</Button>
          </div>
        </Card>

        <Card className="divide-y p-0">
          {questions.map((question, position) => {
            const answer = answers.find((a) => a.questionId === question.id);
            return (
              <div key={question.id} className="p-4">
                <div className="flex items-start gap-2.5">
                  {answer?.isCorrect ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  ) : (
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{position + 1}. {question.question}</p>
                    {!answer?.isCorrect ? (
                      <p className="mt-1 text-sm text-muted-foreground">
                        Ta réponse : <span className="text-destructive">{answer?.userAnswer || "—"}</span>
                        {" · "}Attendu : <span className="text-success">{question.correct_answer}</span>
                      </p>
                    ) : null}
                    {question.explanation ? (
                      <p className="mt-1 text-xs text-muted-foreground">{question.explanation}</p>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </Card>
      </div>
    );
  }

  const isCorrect = submitted && current ? checkAnswer(current, selected) : false;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-4 text-muted-foreground">
        <Link to="/quizzes"><ArrowLeft /> Quiz</Link>
      </Button>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold tracking-tight">{data.quiz.title}</h1>
          <p className="text-sm text-muted-foreground">
            Question {index + 1} / {questions.length} · {correctCount} bonne(s) réponse(s)
          </p>
        </div>
        <Badge variant="outline">{QUESTION_TYPE_LABELS[current!.question_type]}</Badge>
      </div>

      <Progress value={(index / questions.length) * 100} className="mt-4" />

      <Card className="mt-6 p-6 sm:p-8">
        <p className="text-balance text-lg font-medium leading-relaxed">{current!.question}</p>

        <div className="mt-6 space-y-2">
          {current!.question_type === "short_answer" ? (
            <Input
              autoFocus
              value={selected}
              disabled={submitted}
              onChange={(event) => setSelected(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && submit()}
              placeholder="Ta réponse…"
            />
          ) : (
            current!.choices.map((choice) => {
              const isChoiceCorrect = choice === current!.correct_answer;
              const isSelected = selected === choice;
              return (
                <button
                  key={choice}
                  type="button"
                  disabled={submitted}
                  onClick={() => setSelected(choice)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg border-2 px-4 py-3 text-left text-sm transition-colors",
                    submitted && isChoiceCorrect
                      ? "border-success bg-success/10"
                      : submitted && isSelected
                      ? "border-destructive bg-destructive/10"
                      : isSelected
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-accent/50",
                  )}
                >
                  <span className="flex-1">{choice}</span>
                  {submitted && isChoiceCorrect ? <CheckCircle2 className="h-4 w-4 text-success" /> : null}
                  {submitted && isSelected && !isChoiceCorrect ? (
                    <XCircle className="h-4 w-4 text-destructive" />
                  ) : null}
                </button>
              );
            })
          )}
        </div>

        {submitted ? (
          <div
            className={cn(
              "mt-5 rounded-lg p-4",
              isCorrect ? "bg-success/10" : "bg-destructive/10",
            )}
          >
            <p className={cn("text-sm font-semibold", isCorrect ? "text-success" : "text-destructive")}>
              {isCorrect ? "Bonne réponse" : "Réponse incorrecte"}
            </p>
            {!isCorrect ? (
              <p className="mt-1 text-sm">
                Réponse attendue : <span className="font-medium">{current!.correct_answer}</span>
              </p>
            ) : null}
            {current!.explanation ? (
              <p className="mt-2 flex items-start gap-2 text-sm text-muted-foreground">
                <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {current!.explanation}
              </p>
            ) : null}
          </div>
        ) : null}
      </Card>

      <div className="mt-5 flex justify-end">
        {submitted ? (
          <Button onClick={next}>
            {index + 1 >= questions.length ? "Voir le résultat" : "Question suivante"} <ArrowRight />
          </Button>
        ) : (
          <Button disabled={!selected.trim()} onClick={submit}>
            Valider
          </Button>
        )}
      </div>
    </div>
  );
}
