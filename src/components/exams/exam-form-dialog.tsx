import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EXAM_TYPE_LABELS } from "@/lib/constants";
import type { ExamInput } from "@/services/exams";
import type { CourseOverview, CourseSection, Exam, ExamType } from "@/types/database";

interface ExamFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courses: Pick<CourseOverview, "id" | "name">[];
  sections: CourseSection[];
  exam?: Exam | null;
  initialSectionIds?: string[];
  defaultCourseId?: string;
  onSubmit: (input: ExamInput, sectionIds: string[]) => Promise<unknown>;
  submitting?: boolean;
  /** Chargé quand le cours change, pour proposer les bons chapitres. */
  onCourseChange?: (courseId: string) => void;
}

export function ExamFormDialog({
  open, onOpenChange, courses, sections, exam, initialSectionIds, defaultCourseId,
  onSubmit, submitting, onCourseChange,
}: ExamFormDialogProps) {
  const [courseId, setCourseId] = useState("");
  const [title, setTitle] = useState("");
  const [examType, setExamType] = useState<ExamType>("midterm");
  const [examDate, setExamDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [weight, setWeight] = useState("");
  const [sectionIds, setSectionIds] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    const nextCourseId = exam?.course_id ?? defaultCourseId ?? courses[0]?.id ?? "";
    setCourseId(nextCourseId);
    setTitle(exam?.title ?? "");
    setExamType(exam?.exam_type ?? "midterm");
    setExamDate(exam?.exam_date ?? "");
    setStartTime(exam?.start_time?.slice(0, 5) ?? "");
    setEndTime(exam?.end_time?.slice(0, 5) ?? "");
    setLocation(exam?.location ?? "");
    setDescription(exam?.description ?? "");
    setWeight(exam?.weight_percentage != null ? String(exam.weight_percentage) : "");
    setSectionIds(initialSectionIds ?? []);
    if (nextCourseId) onCourseChange?.(nextCourseId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, exam, defaultCourseId]);

  function toggleSection(id: string) {
    setSectionIds((previous) =>
      previous.includes(id) ? previous.filter((value) => value !== id) : [...previous, id],
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    await onSubmit(
      {
        course_id: courseId,
        title: title.trim(),
        exam_type: examType,
        exam_date: examDate,
        start_time: startTime || null,
        end_time: endTime || null,
        location: location.trim() || null,
        description: description.trim() || null,
        weight_percentage: weight === "" ? null : Number(weight),
      },
      sectionIds,
    );
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{exam ? "Modifier l'examen" : "Nouvel examen"}</DialogTitle>
          <DialogDescription>
            Indiquer les chapitres évalués permet de construire une révision ciblée.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Cours *</Label>
              <Select
                value={courseId}
                onValueChange={(value) => {
                  setCourseId(value);
                  setSectionIds([]);
                  onCourseChange?.(value);
                }}
              >
                <SelectTrigger><SelectValue placeholder="Choisir un cours" /></SelectTrigger>
                <SelectContent>
                  {courses.map((course) => (
                    <SelectItem key={course.id} value={course.id}>{course.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={examType} onValueChange={(value) => setExamType(value as ExamType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(EXAM_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="exam-title">Intitulé *</Label>
            <Input
              id="exam-title"
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Examen de mi-session"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="exam-date">Date *</Label>
              <Input
                id="exam-date"
                type="date"
                required
                value={examDate}
                onChange={(event) => setExamDate(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="exam-start">Début</Label>
              <Input
                id="exam-start"
                type="time"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="exam-end">Fin</Label>
              <Input
                id="exam-end"
                type="time"
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="exam-location">Lieu</Label>
              <Input
                id="exam-location"
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                placeholder="Salle A-201"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="exam-weight">Pondération (%)</Label>
              <Input
                id="exam-weight"
                type="number"
                min={0}
                max={100}
                value={weight}
                onChange={(event) => setWeight(event.target.value)}
                placeholder="30"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="exam-description">Description</Label>
            <Textarea
              id="exam-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Matière couverte, documents autorisés…"
            />
          </div>

          {sections.length > 0 ? (
            <div className="space-y-2">
              <Label>Chapitres évalués</Label>
              <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-lg border p-3 scrollbar-thin">
                {sections.map((section) => (
                  <label key={section.id} className="flex cursor-pointer items-center gap-2.5 text-sm">
                    <Checkbox
                      checked={sectionIds.includes(section.id)}
                      onCheckedChange={() => toggleSection(section.id)}
                    />
                    <span className="truncate">{section.title}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Sans sélection, l'examen porte sur l'ensemble du cours.
              </p>
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" loading={submitting} disabled={!courseId}>
              {exam ? "Enregistrer" : "Ajouter l'examen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
