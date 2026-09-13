import { useState } from "react";
import { BookOpen, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { CardsSkeleton } from "@/components/common/loading";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { CourseCard } from "@/components/courses/course-card";
import { CourseFormDialog } from "@/components/courses/course-form-dialog";
import { useCourses, useCreateCourse, useDeleteCourse, useUpdateCourse } from "@/hooks/use-courses";
import type { CourseOverview } from "@/types/database";

export default function CoursesPage() {
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CourseOverview | null>(null);
  const [deleting, setDeleting] = useState<CourseOverview | null>(null);

  const courses = useCourses();
  const createCourse = useCreateCourse();
  const updateCourse = useUpdateCourse(editing?.id ?? "");
  const deleteCourse = useDeleteCourse();

  const filtered = (courses.data ?? []).filter((course) => {
    const haystack = [course.name, course.code, course.professor, course.semester]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(query.trim().toLowerCase());
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mes cours"
        description="Chaque cours regroupe ses chapitres, son contenu, ses cartes et ses examens."
        actions={
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus /> Nouveau cours
          </Button>
        }
      />

      {(courses.data?.length ?? 0) > 0 ? (
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filtrer mes cours…"
            className="pl-9"
          />
        </div>
      ) : null}

      {courses.isLoading ? (
        <CardsSkeleton count={6} />
      ) : courses.isError ? (
        <ErrorState error={courses.error} onRetry={() => void courses.refetch()} />
      ) : filtered.length === 0 && query ? (
        <EmptyState
          icon={Search}
          title="Aucun cours ne correspond"
          description={`Rien ne correspond à « ${query} ».`}
        />
      ) : courses.data?.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="Aucun cours pour le moment."
          description="Crée ton premier cours pour commencer à organiser tes révisions."
          action={
            <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
              <Plus /> Ajouter mon premier cours
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              onEdit={(value) => { setEditing(value); setFormOpen(true); }}
              onDelete={setDeleting}
            />
          ))}
        </div>
      )}

      <CourseFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        course={editing}
        submitting={createCourse.isPending || updateCourse.isPending}
        onSubmit={async (input) => {
          if (editing) await updateCourse.mutateAsync(input);
          else await createCourse.mutateAsync(input);
        }}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Supprimer « ${deleting?.name} » ?`}
        description="Les chapitres, contenus, flashcards, quiz et examens de ce cours seront définitivement supprimés."
        confirmLabel="Supprimer"
        destructive
        onConfirm={() => {
          if (deleting) deleteCourse.mutate(deleting.id);
          setDeleting(null);
        }}
      />
    </div>
  );
}
