import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { SectionInput } from "@/services/sections";
import type { CourseSection } from "@/types/database";

interface SectionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  section?: CourseSection | null;
  nextPosition: number;
  onSubmit: (input: SectionInput) => Promise<unknown>;
  submitting?: boolean;
}

export function SectionFormDialog({
  open, onOpenChange, section, nextPosition, onSubmit, submitting,
}: SectionFormDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle(section?.title ?? "");
    setDescription(section?.description ?? "");
  }, [open, section]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    await onSubmit({
      title: title.trim(),
      description: description.trim() || null,
      position: section?.position ?? nextPosition,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{section ? "Modifier le chapitre" : "Nouveau chapitre"}</DialogTitle>
          <DialogDescription>
            Les chapitres structurent le cours et servent de périmètre aux générations et aux examens.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="section-title">Titre *</Label>
            <Input
              id="section-title"
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Chapitre 3 — Obligations"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="section-description">Description</Label>
            <Textarea
              id="section-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Notions couvertes par ce chapitre…"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" loading={submitting}>
              {section ? "Enregistrer" : "Ajouter"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
