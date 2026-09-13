import { useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, CalendarPlus, FileText, Layers, ListChecks, MessageCircleQuestion, Pencil,
  ArrowDown, ArrowUp, Paperclip, Plus, Sparkles, SquareStack, Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CourseIcon } from "@/components/common/course-icon";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { LoadingScreen, RowsSkeleton } from "@/components/common/loading";
import { CourseFormDialog } from "@/components/courses/course-form-dialog";
import { SectionFormDialog } from "@/components/courses/section-form-dialog";
import { MaterialFormDialog } from "@/components/courses/material-form-dialog";
import { FlashcardFormDialog } from "@/components/courses/flashcard-form-dialog";
import { GenerateDialog } from "@/components/courses/generate-dialog";
import { ExplainDialog } from "@/components/courses/explain-dialog";
import { SummaryView } from "@/components/courses/summary-view";
import { ExamCard } from "@/components/exams/exam-card";
import { ExamFormDialog } from "@/components/exams/exam-form-dialog";
import {
  useCourse, useCreateSection, useDeleteCourse, useDeleteSection, useReorderSections, useSections,
  useUpdateCourse, useUpdateSection,
} from "@/hooks/use-courses";
import {
  useCreateMaterial, useDeleteMaterial, useDeleteSummary, useMaterials, useSummaries,
  useUpdateMaterial,
} from "@/hooks/use-materials";
import { useCreateFlashcard, useDeleteFlashcard, useFlashcards, useUpdateFlashcard } from "@/hooks/use-flashcards";
import { useCreateExam, useExams } from "@/hooks/use-exams";
import { useQuizzes } from "@/hooks/use-quizzes";
import { useSettings } from "@/hooks/use-account";
import { getMaterialFileUrl } from "@/services/materials";
import { DIFFICULTY_LABELS, MATERIAL_TYPE_LABELS } from "@/lib/constants";
import { formatDate, formatRelative } from "@/lib/format";
import type { CourseSection, Flashcard, GenerationType, StudyMaterial } from "@/types/database";

export default function CourseDetailPage() {
  const { courseId = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const tab = searchParams.get("tab") ?? "overview";
  const setTab = (value: string) => setSearchParams({ tab: value }, { replace: true });

  const course = useCourse(courseId);
  const sections = useSections(courseId);
  const materials = useMaterials(courseId);
  const flashcards = useFlashcards(courseId);
  const summaries = useSummaries(courseId);
  const quizzes = useQuizzes(courseId);
  const exams = useExams({ courseId });
  const settings = useSettings();

  const updateCourse = useUpdateCourse(courseId);
  const deleteCourse = useDeleteCourse();
  const createSection = useCreateSection(courseId);
  const updateSection = useUpdateSection(courseId);
  const deleteSection = useDeleteSection(courseId);
  const reorderSections = useReorderSections(courseId);
  const createMaterial = useCreateMaterial(courseId);
  const updateMaterial = useUpdateMaterial(courseId);
  const deleteMaterial = useDeleteMaterial(courseId);
  const deleteSummary = useDeleteSummary(courseId);
  const createFlashcard = useCreateFlashcard(courseId);
  const updateFlashcard = useUpdateFlashcard();
  const deleteFlashcard = useDeleteFlashcard();
  const createExam = useCreateExam();

  const [courseFormOpen, setCourseFormOpen] = useState(false);
  const [deleteCourseOpen, setDeleteCourseOpen] = useState(false);
  const [sectionForm, setSectionForm] = useState<{ open: boolean; section: CourseSection | null }>({ open: false, section: null });
  const [deletingSection, setDeletingSection] = useState<CourseSection | null>(null);
  const [materialForm, setMaterialForm] = useState<{ open: boolean; material: StudyMaterial | null; sectionId: string | null }>({ open: false, material: null, sectionId: null });
  const [deletingMaterial, setDeletingMaterial] = useState<StudyMaterial | null>(null);
  const [cardForm, setCardForm] = useState<{ open: boolean; card: Flashcard | null; sectionId: string | null }>({ open: false, card: null, sectionId: null });
  const [deletingCard, setDeletingCard] = useState<Flashcard | null>(null);
  const [generate, setGenerate] = useState<{ open: boolean; type: GenerationType; sectionId: string | null }>({ open: false, type: "flashcards", sectionId: null });
  const [explainOpen, setExplainOpen] = useState(false);
  const [examFormOpen, setExamFormOpen] = useState(false);
  const [openSummaryId, setOpenSummaryId] = useState<string | null>(null);

  const sectionList = sections.data ?? [];
  const nextPosition = useMemo(
    () => (sectionList.length ? Math.max(...sectionList.map((s) => s.position)) + 1 : 0),
    [sectionList],
  );

  const materialsBySection = useMemo(() => {
    const map = new Map<string, StudyMaterial[]>();
    for (const material of materials.data ?? []) {
      const key = material.section_id ?? "__course__";
      map.set(key, [...(map.get(key) ?? []), material]);
    }
    return map;
  }, [materials.data]);

  const cardsBySection = useMemo(() => {
    const map = new Map<string, number>();
    for (const card of flashcards.data ?? []) {
      const key = card.section_id ?? "__course__";
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [flashcards.data]);

  if (course.isLoading) return <LoadingScreen label="Chargement du cours…" />;
  if (course.isError || !course.data) {
    return <ErrorState error={course.error ?? new Error("Cours introuvable.")} onRetry={() => void course.refetch()} />;
  }

  const data = course.data;

  function openGenerate(type: GenerationType, sectionId: string | null = null) {
    setGenerate({ open: true, type, sectionId });
  }

  /** Échange un chapitre avec son voisin et renumérote toute la liste. */
  function moveSection(position: number, delta: number) {
    const target = position + delta;
    if (target < 0 || target >= sectionList.length) return;
    const reordered = [...sectionList];
    [reordered[position], reordered[target]] = [reordered[target], reordered[position]];
    reorderSections.mutate(reordered.map((section, index) => ({ id: section.id, position: index })));
  }

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
        <Link to="/courses"><ArrowLeft /> Mes cours</Link>
      </Button>

      {/* En-tête du cours */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-4">
          <CourseIcon icon={data.icon} color={data.color} size="lg" />
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">{data.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {[data.code, data.semester, data.professor, data.institution].filter(Boolean).join(" · ") || "Aucune information complémentaire"}
            </p>
            {data.start_date || data.end_date ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {formatDate(data.start_date)} → {formatDate(data.end_date)}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="outline" onClick={() => setExplainOpen(true)}>
            <MessageCircleQuestion /> Explique-moi
          </Button>
          <Button onClick={() => openGenerate("flashcards")}>
            <Sparkles /> Générer des flashcards
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Actions du cours">
                <Pencil className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setCourseFormOpen(true)}>
                <Pencil /> Modifier le cours
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setExamFormOpen(true)}>
                <CalendarPlus /> Ajouter un examen
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={() => setDeleteCourseOpen(true)}
              >
                <Trash2 /> Supprimer le cours
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Indicateurs du cours */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Progression</p>
          <p className="mt-1.5 text-xl font-semibold">{data.progress} %</p>
          <Progress value={data.progress} className="mt-2 h-1.5" />
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Flashcards</p>
          <p className="mt-1.5 text-xl font-semibold">{data.flashcard_count}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {data.mastered_count} maîtrisées · {data.due_count} à réviser
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Prochain examen</p>
          <p className="mt-1.5 text-xl font-semibold">
            {data.next_exam_date ? formatDate(data.next_exam_date) : "—"}
          </p>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {data.next_exam_title ?? "Aucun examen planifié"}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Dernière révision</p>
          <p className="mt-1.5 text-xl font-semibold">{formatRelative(data.last_reviewed_at)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {data.avg_score != null ? `${data.avg_score} % aux quiz` : "Aucun quiz passé"}
          </p>
        </Card>
      </div>

      {data.due_count > 0 ? (
        <Card className="flex flex-col items-start gap-3 border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm">
            <span className="font-semibold">{data.due_count} carte(s)</span> à réviser dans ce cours.
          </p>
          <Button asChild size="sm">
            <Link to={`/study/flashcards?course=${data.id}`}><Sparkles /> Réviser ce cours</Link>
          </Button>
        </Card>
      ) : null}

      <Tabs value={tab} onValueChange={setTab}>
        <div className="overflow-x-auto scrollbar-thin">
          <TabsList>
            <TabsTrigger value="overview">Aperçu</TabsTrigger>
            <TabsTrigger value="sections">Chapitres</TabsTrigger>
            <TabsTrigger value="content">Contenu</TabsTrigger>
            <TabsTrigger value="flashcards">Flashcards</TabsTrigger>
            <TabsTrigger value="quizzes">Quiz</TabsTrigger>
            <TabsTrigger value="summaries">Résumés</TabsTrigger>
            <TabsTrigger value="exams">Examens</TabsTrigger>
          </TabsList>
        </div>

        {/* --- Aperçu --- */}
        <TabsContent value="overview" className="space-y-4">
          {data.description ? (
            <Card>
              <CardHeader><CardTitle className="text-base">Description</CardTitle></CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                  {data.description}
                </p>
              </CardContent>
            </Card>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <ActionTile
              icon={Sparkles}
              title="Résumé intelligent"
              description="Synthèse, définitions, formules et pièges."
              onClick={() => openGenerate("summary")}
            />
            <ActionTile
              icon={Layers}
              title="Flashcards"
              description="Cartes de révision tirées de ton contenu."
              onClick={() => openGenerate("flashcards")}
            />
            <ActionTile
              icon={ListChecks}
              title="Quiz"
              description="Questions pour tester ta compréhension."
              onClick={() => openGenerate("quiz")}
            />
            <ActionTile
              icon={FileText}
              title="Notions clés"
              description="L'essentiel du cours, classé par importance."
              onClick={() => openGenerate("key_concepts")}
            />
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Structure du cours</CardTitle></CardHeader>
            <CardContent>
              {sections.isLoading ? (
                <RowsSkeleton count={3} />
              ) : sectionList.length === 0 ? (
                <EmptyState
                  icon={SquareStack}
                  title="Aucun chapitre."
                  description="Découpe ton cours en chapitres pour générer et réviser par thème."
                  action={
                    <Button size="sm" onClick={() => setSectionForm({ open: true, section: null })}>
                      <Plus /> Ajouter un chapitre
                    </Button>
                  }
                  className="border-0 bg-transparent py-8"
                />
              ) : (
                <ol className="space-y-2">
                  {sectionList.map((section) => (
                    <li key={section.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{section.title}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {cardsBySection.get(section.id) ?? 0} carte(s) ·{" "}
                          {(materialsBySection.get(section.id) ?? []).length} contenu(s)
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => openGenerate("flashcards", section.id)}
                      >
                        <Sparkles /> Générer
                      </Button>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- Chapitres --- */}
        <TabsContent value="sections" className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setSectionForm({ open: true, section: null })}>
              <Plus /> Ajouter un chapitre
            </Button>
          </div>

          {sections.isLoading ? (
            <RowsSkeleton count={4} />
          ) : sectionList.length === 0 ? (
            <EmptyState
              icon={SquareStack}
              title="Aucun chapitre pour le moment."
              description="Exemple : « Chapitre 1 — Introduction », « Chapitre 2 — Valeur temporelle de l'argent »."
              action={
                <Button onClick={() => setSectionForm({ open: true, section: null })}>
                  <Plus /> Créer le premier chapitre
                </Button>
              }
            />
          ) : (
            <div className="space-y-3">
              {sectionList.map((section, position) => (
                <Card key={section.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex shrink-0 flex-col gap-0.5 pt-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        aria-label="Monter le chapitre"
                        disabled={position === 0 || reorderSections.isPending}
                        onClick={() => moveSection(position, -1)}
                      >
                        <ArrowUp className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        aria-label="Descendre le chapitre"
                        disabled={position === sectionList.length - 1 || reorderSections.isPending}
                        onClick={() => moveSection(position, 1)}
                      >
                        <ArrowDown className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold">{section.title}</h3>
                      {section.description ? (
                        <p className="mt-1 text-sm text-muted-foreground">{section.description}</p>
                      ) : null}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Badge variant="secondary">{cardsBySection.get(section.id) ?? 0} cartes</Badge>
                        <Badge variant="secondary">
                          {(materialsBySection.get(section.id) ?? []).length} contenu(s)
                        </Badge>
                      </div>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Actions du chapitre">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => setMaterialForm({ open: true, material: null, sectionId: section.id })}>
                          <Plus /> Ajouter du contenu
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => openGenerate("flashcards", section.id)}>
                          <Sparkles /> Générer des flashcards
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => openGenerate("quiz", section.id)}>
                          <ListChecks /> Générer un quiz
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => openGenerate("summary", section.id)}>
                          <FileText /> Générer un résumé
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => setSectionForm({ open: true, section })}>
                          <Pencil /> Modifier
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onSelect={() => setDeletingSection(section)}
                        >
                          <Trash2 /> Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* --- Contenu --- */}
        <TabsContent value="content" className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setMaterialForm({ open: true, material: null, sectionId: null })}>
              <Plus /> Ajouter du contenu
            </Button>
          </div>

          {materials.isLoading ? (
            <RowsSkeleton count={3} />
          ) : (materials.data?.length ?? 0) === 0 ? (
            <EmptyState
              icon={FileText}
              title="Aucun contenu pédagogique."
              description="Colle tes notes ou le texte du cours : c'est la matière première de toutes les générations."
              action={
                <Button onClick={() => setMaterialForm({ open: true, material: null, sectionId: null })}>
                  <Plus /> Ajouter du contenu
                </Button>
              }
            />
          ) : (
            <div className="space-y-3">
              {(materials.data ?? []).map((material) => (
                <Card key={material.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <h3 className="truncate text-sm font-semibold">{material.title}</h3>
                        <Badge variant="secondary">{MATERIAL_TYPE_LABELS[material.type]}</Badge>
                        {material.section_id ? (
                          <Badge variant="outline">
                            {sectionList.find((s) => s.id === material.section_id)?.title ?? "Chapitre"}
                          </Badge>
                        ) : null}
                      </div>
                      {material.raw_content ? (
                        <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                          {material.raw_content}
                        </p>
                      ) : null}
                      <p className="mt-2 text-xs text-muted-foreground">
                        {material.source ? `${material.source} · ` : ""}
                        {(material.raw_content?.length ?? 0).toLocaleString("fr-FR")} caractères ·{" "}
                        {formatRelative(material.created_at)}
                      </p>
                      {material.file_url ? (
                        <Button
                          variant="link"
                          size="sm"
                          className="mt-1 h-auto p-0 text-xs"
                          onClick={() => void openAttachment(material.file_url as string)}
                        >
                          <Paperclip className="h-3 w-3" /> Ouvrir la pièce jointe
                        </Button>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        aria-label="Modifier"
                        onClick={() => setMaterialForm({ open: true, material, sectionId: material.section_id })}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        aria-label="Supprimer"
                        onClick={() => setDeletingMaterial(material)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* --- Flashcards --- */}
        <TabsContent value="flashcards" className="space-y-4">
          <div className="flex flex-wrap justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => setCardForm({ open: true, card: null, sectionId: null })}>
              <Plus /> Créer manuellement
            </Button>
            <Button size="sm" onClick={() => openGenerate("flashcards")}>
              <Sparkles /> Générer avec Claude
            </Button>
          </div>

          {flashcards.isLoading ? (
            <RowsSkeleton count={4} />
          ) : (flashcards.data?.length ?? 0) === 0 ? (
            <EmptyState
              icon={Layers}
              title="Aucune flashcard."
              description="Génère-les depuis ton contenu de cours, ou crée-les une par une."
              action={
                <Button onClick={() => openGenerate("flashcards")}>
                  <Sparkles /> Générer des flashcards
                </Button>
              }
            />
          ) : (
            <div className="space-y-2">
              {(flashcards.data ?? []).map((card) => (
                <Card key={card.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{card.question}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{card.answer}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {card.topic ? <Badge variant="secondary">{card.topic}</Badge> : null}
                        <Badge variant="outline">{DIFFICULTY_LABELS[card.difficulty]}</Badge>
                        {card.created_by === "claude" ? <Badge>Claude</Badge> : null}
                        {card.progress ? (
                          <Badge variant={card.progress.status === "mastered" ? "success" : "secondary"}>
                            {card.progress.status === "mastered"
                              ? "Maîtrisée"
                              : card.progress.status === "review"
                              ? "En révision"
                              : card.progress.status === "lapsed"
                              ? "Oubliée"
                              : "En apprentissage"}
                          </Badge>
                        ) : (
                          <Badge variant="outline">Jamais révisée</Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        aria-label="Modifier"
                        onClick={() => setCardForm({ open: true, card, sectionId: card.section_id })}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        aria-label="Supprimer"
                        onClick={() => setDeletingCard(card)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* --- Quiz --- */}
        <TabsContent value="quizzes" className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => openGenerate("quiz")}>
              <Sparkles /> Générer un quiz
            </Button>
          </div>

          {quizzes.isLoading ? (
            <RowsSkeleton count={3} />
          ) : (quizzes.data?.length ?? 0) === 0 ? (
            <EmptyState
              icon={ListChecks}
              title="Aucun quiz."
              description="Un quiz généré depuis ton contenu permet de repérer précisément ce qui n'est pas acquis."
              action={
                <Button onClick={() => openGenerate("quiz")}>
                  <Sparkles /> Générer un quiz
                </Button>
              }
            />
          ) : (
            <div className="space-y-2">
              {(quizzes.data ?? []).map((quiz) => (
                <Card key={quiz.id} className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{quiz.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {quiz.question_count} questions · {DIFFICULTY_LABELS[quiz.difficulty]}
                      {quiz.best_score != null ? ` · Meilleur score ${quiz.best_score} %` : ""}
                    </p>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/quizzes/${quiz.id}`}>Lancer</Link>
                  </Button>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* --- Résumés --- */}
        <TabsContent value="summaries" className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => openGenerate("summary")}>
              <Sparkles /> Générer un résumé
            </Button>
          </div>

          {summaries.isLoading ? (
            <RowsSkeleton count={2} />
          ) : (summaries.data?.length ?? 0) === 0 ? (
            <EmptyState
              icon={FileText}
              title="Aucun résumé."
              description="Un résumé structuré : synthèse, définitions, formules, pièges et questions probables."
              action={
                <Button onClick={() => openGenerate("summary")}>
                  <Sparkles /> Générer un résumé
                </Button>
              }
            />
          ) : (
            <div className="space-y-3">
              {(summaries.data ?? []).map((summary) => {
                const open = openSummaryId === summary.id;
                return (
                  <Card key={summary.id}>
                    <div className="flex items-start justify-between gap-3 p-4">
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() => setOpenSummaryId(open ? null : summary.id)}
                      >
                        <p className="truncate text-sm font-semibold">{summary.title}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {summary.section_id
                            ? sectionList.find((s) => s.id === summary.section_id)?.title ?? "Chapitre"
                            : "Tout le cours"}{" "}
                          · {formatRelative(summary.created_at)}
                        </p>
                      </button>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setOpenSummaryId(open ? null : summary.id)}>
                          {open ? "Replier" : "Ouvrir"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          aria-label="Supprimer le résumé"
                          onClick={() => deleteSummary.mutate(summary.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    {open ? (
                      <div className="border-t p-5">
                        <SummaryView content={summary.content} />
                      </div>
                    ) : null}
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* --- Examens --- */}
        <TabsContent value="exams" className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setExamFormOpen(true)}>
              <CalendarPlus /> Ajouter un examen
            </Button>
          </div>

          {exams.isLoading ? (
            <RowsSkeleton count={2} />
          ) : (exams.data?.length ?? 0) === 0 ? (
            <EmptyState
              icon={CalendarPlus}
              title="Aucun examen pour ce cours."
              description="Enregistre la date pour activer le compte à rebours et la révision ciblée."
              action={
                <Button onClick={() => setExamFormOpen(true)}>
                  <CalendarPlus /> Ajouter un examen
                </Button>
              }
            />
          ) : (
            <div className="space-y-3">
              {(exams.data ?? []).map((exam) => <ExamCard key={exam.id} exam={exam} />)}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* --- Dialogues --- */}
      <CourseFormDialog
        open={courseFormOpen}
        onOpenChange={setCourseFormOpen}
        course={data}
        submitting={updateCourse.isPending}
        onSubmit={async (input) => { await updateCourse.mutateAsync(input); }}
      />

      <ConfirmDialog
        open={deleteCourseOpen}
        onOpenChange={setDeleteCourseOpen}
        title={`Supprimer « ${data.name} » ?`}
        description="Tout le contenu associé sera définitivement supprimé."
        confirmLabel="Supprimer"
        destructive
        onConfirm={() => deleteCourse.mutate(data.id, { onSuccess: () => navigate("/courses") })}
      />

      <SectionFormDialog
        open={sectionForm.open}
        onOpenChange={(open) => setSectionForm((prev) => ({ ...prev, open }))}
        section={sectionForm.section}
        nextPosition={nextPosition}
        submitting={createSection.isPending || updateSection.isPending}
        onSubmit={async (input) => {
          if (sectionForm.section) {
            await updateSection.mutateAsync({ id: sectionForm.section.id, input });
          } else {
            await createSection.mutateAsync(input);
          }
        }}
      />

      <ConfirmDialog
        open={Boolean(deletingSection)}
        onOpenChange={(open) => !open && setDeletingSection(null)}
        title={`Supprimer « ${deletingSection?.title} » ?`}
        description="Les contenus et cartes rattachés à ce chapitre seront rattachés au cours."
        confirmLabel="Supprimer"
        destructive
        onConfirm={() => {
          if (deletingSection) deleteSection.mutate(deletingSection.id);
          setDeletingSection(null);
        }}
      />

      <MaterialFormDialog
        open={materialForm.open}
        onOpenChange={(open) => setMaterialForm((prev) => ({ ...prev, open }))}
        courseId={courseId}
        sections={sectionList}
        material={materialForm.material}
        defaultSectionId={materialForm.sectionId}
        submitting={createMaterial.isPending || updateMaterial.isPending}
        onSubmit={async (input) => {
          if (materialForm.material) {
            await updateMaterial.mutateAsync({ id: materialForm.material.id, input });
          } else {
            await createMaterial.mutateAsync(input);
          }
        }}
      />

      <ConfirmDialog
        open={Boolean(deletingMaterial)}
        onOpenChange={(open) => !open && setDeletingMaterial(null)}
        title="Supprimer ce contenu ?"
        description="Les flashcards et résumés déjà générés à partir de ce contenu sont conservés."
        confirmLabel="Supprimer"
        destructive
        onConfirm={() => {
          if (deletingMaterial) deleteMaterial.mutate(deletingMaterial.id);
          setDeletingMaterial(null);
        }}
      />

      <FlashcardFormDialog
        open={cardForm.open}
        onOpenChange={(open) => setCardForm((prev) => ({ ...prev, open }))}
        sections={sectionList}
        card={cardForm.card}
        defaultSectionId={cardForm.sectionId}
        submitting={createFlashcard.isPending || updateFlashcard.isPending}
        onSubmit={async (input) => {
          if (cardForm.card) await updateFlashcard.mutateAsync({ id: cardForm.card.id, input });
          else await createFlashcard.mutateAsync(input);
        }}
      />

      <ConfirmDialog
        open={Boolean(deletingCard)}
        onOpenChange={(open) => !open && setDeletingCard(null)}
        title="Supprimer cette flashcard ?"
        description="Son historique de révision sera également supprimé."
        confirmLabel="Supprimer"
        destructive
        onConfirm={() => {
          if (deletingCard) deleteFlashcard.mutate(deletingCard.id);
          setDeletingCard(null);
        }}
      />

      <GenerateDialog
        open={generate.open}
        onOpenChange={(open) => setGenerate((prev) => ({ ...prev, open }))}
        courseId={courseId}
        sections={sectionList}
        defaultSectionId={generate.sectionId}
        generationType={generate.type}
        defaultCount={settings.data?.ai_default_card_count ?? 15}
        defaultDifficulty={settings.data?.ai_default_difficulty ?? "medium"}
        onGenerated={(result) => {
          if (result.generation_type === "quiz" && result.result_id) navigate(`/quizzes/${result.result_id}`);
          else if (result.generation_type === "flashcards") setTab("flashcards");
          else setTab("summaries");
        }}
      />

      <ExplainDialog
        open={explainOpen}
        onOpenChange={setExplainOpen}
        courseId={courseId}
        sections={sectionList}
      />

      <ExamFormDialog
        open={examFormOpen}
        onOpenChange={setExamFormOpen}
        courses={[{ id: data.id, name: data.name }]}
        sections={sectionList}
        defaultCourseId={data.id}
        submitting={createExam.isPending}
        onSubmit={async (input, sectionIds) => {
          await createExam.mutateAsync({ input, sectionIds });
        }}
      />
    </div>
  );
}

/** Génère une URL signée éphémère pour le document joint (bucket privé). */
async function openAttachment(path: string) {
  const url = await getMaterialFileUrl(path);
  if (url) window.open(url, "_blank", "noopener,noreferrer");
  else toast.error("Impossible d'ouvrir ce document.");
}

function ActionTile({
  icon: Icon, title, description, onClick,
}: {
  icon: typeof Sparkles;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-start gap-2 rounded-xl border bg-card p-4 text-left transition-shadow hover:shadow-lifted"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <span className="text-sm font-semibold">{title}</span>
      <span className="text-xs text-muted-foreground">{description}</span>
    </button>
  );
}
