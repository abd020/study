import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getCourseIcon } from "@/components/common/course-icon";
import { COURSE_COLORS, COURSE_ICONS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { CourseInput } from "@/services/courses";
import type { Course } from "@/types/database";

interface CourseFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  course?: Course | null;
  onSubmit: (input: CourseInput) => Promise<unknown>;
  submitting?: boolean;
}

const EMPTY: CourseInput = {
  name: "",
  code: "",
  professor: "",
  institution: "",
  semester: "",
  description: "",
  color: COURSE_COLORS[0],
  icon: COURSE_ICONS[0],
  start_date: null,
  end_date: null,
};

export function CourseFormDialog({
  open, onOpenChange, course, onSubmit, submitting,
}: CourseFormDialogProps) {
  const [form, setForm] = useState<CourseInput>(EMPTY);

  useEffect(() => {
    if (!open) return;
    setForm(
      course
        ? {
            name: course.name,
            code: course.code ?? "",
            professor: course.professor ?? "",
            institution: course.institution ?? "",
            semester: course.semester ?? "",
            description: course.description ?? "",
            color: course.color,
            icon: course.icon,
            start_date: course.start_date,
            end_date: course.end_date,
          }
        : EMPTY,
    );
  }, [open, course]);

  const set = <K extends keyof CourseInput>(key: K, value: CourseInput[K]) =>
    setForm((previous) => ({ ...previous, [key]: value }));

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    await onSubmit({
      ...form,
      code: form.code?.trim() || null,
      professor: form.professor?.trim() || null,
      institution: form.institution?.trim() || null,
      semester: form.semester?.trim() || null,
      description: form.description?.trim() || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{course ? "Modifier le cours" : "Nouveau cours"}</DialogTitle>
          <DialogDescription>
            Ces informations servent à organiser tes chapitres, examens et révisions.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nom du cours *</Label>
            <Input
              id="name"
              required
              value={form.name}
              onChange={(event) => set("name", event.target.value)}
              placeholder="Finance d'entreprise"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="code">Code</Label>
              <Input
                id="code"
                value={form.code ?? ""}
                onChange={(event) => set("code", event.target.value)}
                placeholder="FIN-2010"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="semester">Semestre</Label>
              <Input
                id="semester"
                value={form.semester ?? ""}
                onChange={(event) => set("semester", event.target.value)}
                placeholder="Automne 2026"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="professor">Professeur</Label>
              <Input
                id="professor"
                value={form.professor ?? ""}
                onChange={(event) => set("professor", event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="institution">Établissement</Label>
              <Input
                id="institution"
                value={form.institution ?? ""}
                onChange={(event) => set("institution", event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="start_date">Date de début</Label>
              <Input
                id="start_date"
                type="date"
                value={form.start_date ?? ""}
                onChange={(event) => set("start_date", event.target.value || null)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end_date">Date de fin</Label>
              <Input
                id="end_date"
                type="date"
                value={form.end_date ?? ""}
                onChange={(event) => set("end_date", event.target.value || null)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={form.description ?? ""}
              onChange={(event) => set("description", event.target.value)}
              placeholder="Objectifs du cours, points d'attention…"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Couleur</Label>
              <div className="flex flex-wrap gap-1.5">
                {COURSE_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`Couleur ${color}`}
                    onClick={() => set("color", color)}
                    className={cn(
                      "h-7 w-7 rounded-full border-2 transition-transform hover:scale-110",
                      form.color === color ? "border-foreground" : "border-transparent",
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Icône</Label>
              <div className="flex flex-wrap gap-1.5">
                {COURSE_ICONS.map((icon) => {
                  const Icon = getCourseIcon(icon);
                  return (
                    <button
                      key={icon}
                      type="button"
                      aria-label={`Icône ${icon}`}
                      onClick={() => set("icon", icon)}
                      className={cn(
                        "flex h-7 w-7 items-center justify-center rounded-md border transition-colors",
                        form.icon === icon
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:bg-accent",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" loading={submitting}>
              {course ? "Enregistrer" : "Créer le cours"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
