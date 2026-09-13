import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useGenerate } from "@/hooks/use-ai";
import { DIFFICULTY_LABELS } from "@/lib/constants";
import type { CourseSection, Difficulty, GenerationType } from "@/types/database";

interface GenerateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string;
  sections: CourseSection[];
  defaultSectionId?: string | null;
  generationType: GenerationType;
  defaultCount?: number;
  defaultDifficulty?: Difficulty;
  onGenerated?: (result: { generation_type?: GenerationType; result_id: string | null; items_created: number }) => void;
}

const NO_SECTION = "__all__";

const META: Record<string, { title: string; description: string; cta: string; hasCount: boolean }> = {
  flashcards: {
    title: "Générer des flashcards",
    description: "Claude lit le contenu du chapitre sélectionné et en tire des cartes de révision.",
    cta: "Générer les flashcards",
    hasCount: true,
  },
  quiz: {
    title: "Générer un quiz",
    description: "Questions à choix multiples, vrai/faux et réponses courtes tirées de ton matériel.",
    cta: "Générer le quiz",
    hasCount: true,
  },
  summary: {
    title: "Générer un résumé",
    description:
      "Synthèse, notions clés, définitions, formules, pièges et questions probables d'examen.",
    cta: "Générer le résumé",
    hasCount: false,
  },
  key_concepts: {
    title: "Extraire les notions clés",
    description: "Les notions essentielles du chapitre, classées par importance.",
    cta: "Extraire les notions",
    hasCount: false,
  },
  study_plan: {
    title: "Construire un plan de révision",
    description: "Un plan jour par jour jusqu'à la date de l'examen.",
    cta: "Construire le plan",
    hasCount: false,
  },
  explanation: {
    title: "Explication",
    description: "",
    cta: "Demander",
    hasCount: false,
  },
};

export function GenerateDialog({
  open, onOpenChange, courseId, sections, defaultSectionId, generationType,
  defaultCount = 15, defaultDifficulty = "medium", onGenerated,
}: GenerateDialogProps) {
  const [sectionId, setSectionId] = useState(NO_SECTION);
  const [count, setCount] = useState(defaultCount);
  const [difficulty, setDifficulty] = useState<Difficulty>(defaultDifficulty);
  const generate = useGenerate();
  const meta = META[generationType];

  useEffect(() => {
    if (!open) return;
    setSectionId(defaultSectionId ?? NO_SECTION);
    setCount(defaultCount);
    setDifficulty(defaultDifficulty);
  }, [open, defaultSectionId, defaultCount, defaultDifficulty]);

  async function run(force: boolean) {
    const result = await generate.mutateAsync({
      courseId,
      sectionId: sectionId === NO_SECTION ? null : sectionId,
      generationType,
      force,
      options: { count, difficulty },
    });

    if (!result.duplicate) {
      toast.success(
        generationType === "flashcards"
          ? `${result.items_created} flashcards ajoutées.`
          : generationType === "quiz"
          ? `Quiz de ${result.items_created} questions créé.`
          : "Contenu généré et enregistré.",
      );
      onGenerated?.(result);
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> {meta.title}
          </DialogTitle>
          <DialogDescription>{meta.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Chapitre</Label>
            <Select value={sectionId} onValueChange={setSectionId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_SECTION}>Tout le cours</SelectItem>
                {sections.map((section) => (
                  <SelectItem key={section.id} value={section.id}>{section.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {meta.hasCount ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="generate-count">
                  Nombre {generationType === "quiz" ? "de questions" : "de cartes"}
                </Label>
                <Input
                  id="generate-count"
                  type="number"
                  min={3}
                  max={50}
                  value={count}
                  onChange={(event) => setCount(Number(event.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Niveau de difficulté</Label>
                <Select value={difficulty} onValueChange={(value) => setDifficulty(value as Difficulty)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(DIFFICULTY_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}

          <p className="rounded-lg bg-muted px-3 py-2.5 text-xs text-muted-foreground">
            Claude ne travaille qu'à partir du contenu enregistré dans ce cours. Si le matériel est
            insuffisant, la génération est refusée plutôt qu'inventée.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={generate.isPending}>
            Annuler
          </Button>
          {generate.data?.duplicate ? (
            <Button loading={generate.isPending} onClick={() => void run(true)}>
              Régénérer quand même
            </Button>
          ) : (
            <Button loading={generate.isPending} onClick={() => void run(false)}>
              <Sparkles /> {meta.cta}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
