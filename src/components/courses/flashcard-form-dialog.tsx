import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DIFFICULTY_LABELS } from "@/lib/constants";
import type { FlashcardInput } from "@/services/flashcards";
import type { CourseSection, Difficulty, Flashcard } from "@/types/database";

interface FlashcardFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sections: CourseSection[];
  card?: Flashcard | null;
  defaultSectionId?: string | null;
  onSubmit: (input: FlashcardInput) => Promise<unknown>;
  submitting?: boolean;
}

const NO_SECTION = "__none__";

export function FlashcardFormDialog({
  open, onOpenChange, sections, card, defaultSectionId, onSubmit, submitting,
}: FlashcardFormDialogProps) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [explanation, setExplanation] = useState("");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [sectionId, setSectionId] = useState(NO_SECTION);

  useEffect(() => {
    if (!open) return;
    setQuestion(card?.question ?? "");
    setAnswer(card?.answer ?? "");
    setExplanation(card?.explanation ?? "");
    setTopic(card?.topic ?? "");
    setDifficulty(card?.difficulty ?? "medium");
    setSectionId(card?.section_id ?? defaultSectionId ?? NO_SECTION);
  }, [open, card, defaultSectionId]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    await onSubmit({
      question: question.trim(),
      answer: answer.trim(),
      explanation: explanation.trim() || null,
      topic: topic.trim() || null,
      difficulty,
      section_id: sectionId === NO_SECTION ? null : sectionId,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{card ? "Modifier la flashcard" : "Nouvelle flashcard"}</DialogTitle>
          <DialogDescription>
            Une seule notion par carte : la révision espacée n'en est que plus efficace.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="card-question">Question *</Label>
            <Textarea
              id="card-question"
              required
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              className="min-h-[70px]"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="card-answer">Réponse *</Label>
            <Textarea
              id="card-answer"
              required
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              className="min-h-[70px]"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="card-explanation">Explication</Label>
            <Textarea
              id="card-explanation"
              value={explanation}
              onChange={(event) => setExplanation(event.target.value)}
              className="min-h-[60px]"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="card-topic">Notion</Label>
              <Input
                id="card-topic"
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                placeholder="Obligations"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Difficulté</Label>
              <Select value={difficulty} onValueChange={(value) => setDifficulty(value as Difficulty)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(DIFFICULTY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Chapitre</Label>
              <Select value={sectionId} onValueChange={setSectionId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_SECTION}>Cours entier</SelectItem>
                  {sections.map((section) => (
                    <SelectItem key={section.id} value={section.id}>{section.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" loading={submitting}>
              {card ? "Enregistrer" : "Créer la carte"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
