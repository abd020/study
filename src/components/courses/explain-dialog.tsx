import { useEffect, useState } from "react";
import { AlertTriangle, MessageCircleQuestion, Sparkles } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useGenerate } from "@/hooks/use-ai";
import type { CourseSection } from "@/types/database";

interface ExplainDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string;
  sections: CourseSection[];
  defaultSectionId?: string | null;
  defaultQuestion?: string;
}

const NO_SECTION = "__all__";

const MODES = [
  { value: "simple", label: "Explique simplement" },
  { value: "example", label: "Donne-moi un exemple" },
  { value: "beginner", label: "Explique comme si j'étais débutant" },
  { value: "exam_question", label: "Donne-moi une question d'examen" },
  { value: "why_wrong", label: "Explique pourquoi ma réponse est fausse" },
  { value: "free", label: "Question libre" },
];

export function ExplainDialog({
  open, onOpenChange, courseId, sections, defaultSectionId, defaultQuestion,
}: ExplainDialogProps) {
  const [question, setQuestion] = useState("");
  const [mode, setMode] = useState("simple");
  const [sectionId, setSectionId] = useState(NO_SECTION);
  const generate = useGenerate();

  useEffect(() => {
    if (!open) return;
    setQuestion(defaultQuestion ?? "");
    setMode("simple");
    setSectionId(defaultSectionId ?? NO_SECTION);
    generate.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultQuestion, defaultSectionId]);

  const result = generate.data;

  async function ask() {
    await generate.mutateAsync({
      courseId,
      sectionId: sectionId === NO_SECTION ? null : sectionId,
      generationType: "explanation",
      force: true,
      options: { question: question.trim(), mode },
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircleQuestion className="h-4 w-4 text-primary" /> Explique-moi
          </DialogTitle>
          <DialogDescription>
            Pose une question sur ce cours. La réponse s'appuie sur ton matériel : si l'information
            n'y figure pas, Claude te le dit explicitement.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
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
            <div className="space-y-1.5">
              <Label>Type de réponse</Label>
              <Select value={mode} onValueChange={setMode}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MODES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="explain-question">Ta question</Label>
            <Textarea
              id="explain-question"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Pourquoi le prix d'une obligation baisse-t-il quand les taux montent ?"
              className="min-h-[80px]"
            />
          </div>

          {result?.answer ? (
            <div className="space-y-3 rounded-lg border bg-card p-4">
              {result.grounded === false ? (
                <div className="flex items-start gap-2 rounded-md bg-warning/10 px-3 py-2 text-xs text-warning">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    Cette réponse dépasse le contenu enregistré.
                    {result.missing_from_material ? ` Manquant : ${result.missing_from_material}` : ""}
                  </span>
                </div>
              ) : null}

              <p className="whitespace-pre-wrap text-sm leading-relaxed">{result.answer}</p>

              {result.follow_up_questions?.length ? (
                <div className="border-t pt-3">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    Pour aller plus loin
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {result.follow_up_questions.map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setQuestion(item)}
                        className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fermer</Button>
          <Button
            loading={generate.isPending}
            disabled={question.trim().length < 5}
            onClick={() => void ask()}
          >
            <Sparkles /> {result?.answer ? "Reposer la question" : "Demander à Claude"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
