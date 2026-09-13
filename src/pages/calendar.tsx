import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth,
  startOfMonth, startOfWeek, subMonths,
} from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarPlus, ChevronLeft, ChevronRight, Clock, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { RowsSkeleton } from "@/components/common/loading";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { ExamCard } from "@/components/exams/exam-card";
import { ExamFormDialog } from "@/components/exams/exam-form-dialog";
import { useCourses, useSections } from "@/hooks/use-courses";
import {
  useCreateExam, useDeleteExam, useExamReadiness, useExams, useExamSectionIds, useUpdateExam,
} from "@/hooks/use-exams";
import { EXAM_TYPE_LABELS } from "@/lib/constants";
import { formatCountdown, formatDate, toDate } from "@/lib/format";
import type { Exam, ExamWithCourse } from "@/types/database";
import { cn } from "@/lib/utils";

export default function CalendarPage() {
  const [cursor, setCursor] = useState(new Date());
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Exam | null>(null);
  const [deleting, setDeleting] = useState<ExamWithCourse | null>(null);
  const [selected, setSelected] = useState<ExamWithCourse | null>(null);
  const [formCourseId, setFormCourseId] = useState<string | undefined>();

  const courses = useCourses();
  const exams = useExams();
  const sections = useSections(formCourseId);
  const editingSections = useExamSectionIds(editing?.id);
  const createExam = useCreateExam();
  const updateExam = useUpdateExam();
  const deleteExam = useDeleteExam();

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [cursor]);

  const examsByDay = useMemo(() => {
    const map = new Map<string, ExamWithCourse[]>();
    for (const exam of exams.data ?? []) {
      const key = exam.exam_date;
      map.set(key, [...(map.get(key) ?? []), exam]);
    }
    return map;
  }, [exams.data]);

  const upcoming = (exams.data ?? []).filter((exam) => (toDate(exam.exam_date)?.getTime() ?? 0) >= Date.now() - 86_400_000);
  const past = (exams.data ?? []).filter((exam) => (toDate(exam.exam_date)?.getTime() ?? 0) < Date.now() - 86_400_000).reverse();

  function openCreate() {
    setEditing(null);
    setFormCourseId(courses.data?.[0]?.id);
    setFormOpen(true);
  }

  function openEdit(exam: ExamWithCourse) {
    setEditing(exam);
    setFormCourseId(exam.course_id);
    setFormOpen(true);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendrier"
        description="Examens, travaux et évaluations, avec le compte à rebours et le niveau de préparation."
        actions={
          <Button onClick={openCreate} disabled={(courses.data?.length ?? 0) === 0}>
            <CalendarPlus /> Ajouter un examen
          </Button>
        }
      />

      {(courses.data?.length ?? 0) === 0 && !courses.isLoading ? (
        <EmptyState
          title="Crée d'abord un cours"
          description="Un examen est toujours rattaché à un cours."
        />
      ) : null}

      <Tabs defaultValue="month">
        <TabsList>
          <TabsTrigger value="month">Mois</TabsTrigger>
          <TabsTrigger value="week">Semaine</TabsTrigger>
          <TabsTrigger value="list">Liste</TabsTrigger>
        </TabsList>

        {/* --- Vue mois --- */}
        <TabsContent value="month">
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <p className="text-sm font-semibold capitalize">
                {format(cursor, "MMMM yyyy", { locale: fr })}
              </p>
              <div className="flex gap-1">
                <Button variant="outline" size="icon" className="h-7 w-7" aria-label="Mois précédent" onClick={() => setCursor(subMonths(cursor, 1))}>
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <Button variant="outline" size="sm" className="h-7" onClick={() => setCursor(new Date())}>
                  Aujourd'hui
                </Button>
                <Button variant="outline" size="icon" className="h-7 w-7" aria-label="Mois suivant" onClick={() => setCursor(addMonths(cursor, 1))}>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-7 border-b bg-muted/40 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((day) => (
                <div key={day} className="py-2">{day}</div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {days.map((day) => {
                const key = format(day, "yyyy-MM-dd");
                const dayExams = examsByDay.get(key) ?? [];
                const outside = !isSameMonth(day, cursor);
                const today = isSameDay(day, new Date());

                return (
                  <div
                    key={key}
                    className={cn(
                      "min-h-[84px] border-b border-r p-1.5 last:border-r-0 sm:min-h-[104px]",
                      outside && "bg-muted/30",
                    )}
                  >
                    <span
                      className={cn(
                        "inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px]",
                        today ? "bg-primary font-semibold text-primary-foreground" : outside ? "text-muted-foreground/60" : "text-muted-foreground",
                      )}
                    >
                      {format(day, "d")}
                    </span>

                    <div className="mt-1 space-y-1">
                      {dayExams.map((exam) => (
                        <button
                          key={exam.id}
                          type="button"
                          onClick={() => setSelected(exam)}
                          className="block w-full truncate rounded px-1.5 py-1 text-left text-[11px] font-medium transition-opacity hover:opacity-80"
                          style={{
                            backgroundColor: `${exam.course?.color ?? "#4f46e5"}1f`,
                            color: exam.course?.color ?? "#4f46e5",
                          }}
                        >
                          {exam.title}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </TabsContent>

        {/* --- Vue semaine --- */}
        <TabsContent value="week">
          <div className="grid gap-2 sm:grid-cols-7">
            {eachDayOfInterval({
              start: startOfWeek(cursor, { weekStartsOn: 1 }),
              end: endOfWeek(cursor, { weekStartsOn: 1 }),
            }).map((day) => {
              const key = format(day, "yyyy-MM-dd");
              const dayExams = examsByDay.get(key) ?? [];
              return (
                <Card key={key} className={cn("p-3", isSameDay(day, new Date()) && "border-primary")}>
                  <p className="text-xs font-medium capitalize text-muted-foreground">
                    {format(day, "EEE d", { locale: fr })}
                  </p>
                  <div className="mt-2 space-y-1.5">
                    {dayExams.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground/60">—</p>
                    ) : (
                      dayExams.map((exam) => (
                        <button
                          key={exam.id}
                          type="button"
                          onClick={() => setSelected(exam)}
                          className="block w-full rounded px-2 py-1.5 text-left text-[11px] font-medium"
                          style={{
                            backgroundColor: `${exam.course?.color ?? "#4f46e5"}1f`,
                            color: exam.course?.color ?? "#4f46e5",
                          }}
                        >
                          {exam.title}
                        </button>
                      ))
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* --- Vue liste --- */}
        <TabsContent value="list" className="space-y-6">
          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              À venir
            </h2>
            {exams.isLoading ? (
              <RowsSkeleton count={3} />
            ) : upcoming.length === 0 ? (
              <EmptyState
                icon={CalendarPlus}
                title="Aucun examen à venir."
                description="Ajoute une date pour activer le compte à rebours et la révision ciblée."
                action={
                  <Button onClick={openCreate} disabled={(courses.data?.length ?? 0) === 0}>
                    <CalendarPlus /> Ajouter un examen
                  </Button>
                }
              />
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {upcoming.map((exam) => (
                  <ExamCard key={exam.id} exam={exam} onEdit={openEdit} onDelete={setDeleting} />
                ))}
              </div>
            )}
          </section>

          {past.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Passés
              </h2>
              <div className="space-y-2">
                {past.map((exam) => (
                  <Card key={exam.id} className="flex items-center justify-between gap-3 p-3.5 opacity-70">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{exam.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {exam.course?.name} · {formatDate(exam.exam_date)}
                      </p>
                    </div>
                    <Badge variant="secondary">{EXAM_TYPE_LABELS[exam.exam_type]}</Badge>
                  </Card>
                ))}
              </div>
            </section>
          ) : null}
        </TabsContent>
      </Tabs>

      {/* Détail d'un événement */}
      <ExamDetailDialog
        exam={selected}
        onOpenChange={(open) => !open && setSelected(null)}
        onEdit={(exam) => { setSelected(null); openEdit(exam); }}
      />

      <ExamFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        courses={courses.data ?? []}
        sections={sections.data ?? []}
        exam={editing}
        initialSectionIds={editing ? editingSections.data ?? [] : []}
        defaultCourseId={formCourseId}
        onCourseChange={setFormCourseId}
        submitting={createExam.isPending || updateExam.isPending}
        onSubmit={async (input, sectionIds) => {
          if (editing) await updateExam.mutateAsync({ examId: editing.id, input, sectionIds });
          else await createExam.mutateAsync({ input, sectionIds });
        }}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Supprimer « ${deleting?.title} » ?`}
        description="L'examen et les chapitres associés seront supprimés."
        confirmLabel="Supprimer"
        destructive
        onConfirm={() => {
          if (deleting) deleteExam.mutate(deleting.id);
          setDeleting(null);
        }}
      />
    </div>
  );
}

function ExamDetailDialog({
  exam, onOpenChange, onEdit,
}: {
  exam: ExamWithCourse | null;
  onOpenChange: (open: boolean) => void;
  onEdit: (exam: ExamWithCourse) => void;
}) {
  const readiness = useExamReadiness(exam?.id);

  return (
    <Dialog open={Boolean(exam)} onOpenChange={onOpenChange}>
      <DialogContent>
        {exam ? (
          <>
            <DialogHeader>
              <DialogTitle>{exam.title}</DialogTitle>
              <DialogDescription>
                {exam.course?.name} · {EXAM_TYPE_LABELS[exam.exam_type]}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="secondary">{formatDate(exam.exam_date, "EEEE d MMMM yyyy")}</Badge>
                <Badge variant="outline">{formatCountdown(exam.exam_date)}</Badge>
                {exam.start_time ? (
                  <Badge variant="outline"><Clock className="h-3 w-3" /> {exam.start_time.slice(0, 5)}</Badge>
                ) : null}
                {exam.location ? (
                  <Badge variant="outline"><MapPin className="h-3 w-3" /> {exam.location}</Badge>
                ) : null}
                {exam.weight_percentage != null ? (
                  <Badge variant="outline">{exam.weight_percentage} % de la note</Badge>
                ) : null}
              </div>

              {exam.description ? (
                <p className="text-sm text-muted-foreground">{exam.description}</p>
              ) : null}

              {readiness.data ? (
                <div className="rounded-lg border p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Préparation estimée
                  </p>
                  <p className="mt-1 text-2xl font-semibold">{readiness.data.readiness} %</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {readiness.data.cards_mastered}/{readiness.data.cards_total} cartes maîtrisées ·{" "}
                    {readiness.data.sections_covered}/{readiness.data.sections_total} chapitres couverts
                    {readiness.data.quiz_score != null ? ` · ${readiness.data.quiz_score} % aux quiz` : ""}
                  </p>
                  {readiness.data.recommended_daily_cards > 0 && readiness.data.days_remaining > 0 ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Rythme conseillé : {readiness.data.recommended_daily_cards} carte(s) par jour.
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="flex gap-2">
                <Button asChild className="flex-1">
                  <Link to={`/study/flashcards?exam=${exam.id}`}>Réviser cet examen</Link>
                </Button>
                <Button variant="outline" onClick={() => onEdit(exam)}>Modifier</Button>
              </div>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
