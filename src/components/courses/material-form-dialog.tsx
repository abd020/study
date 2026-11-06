import { useEffect, useRef, useState } from "react";
import { FileText, FileUp, Loader2, Paperclip, TriangleAlert, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MATERIAL_TYPE_LABELS } from "@/lib/constants";
import { extractText, UnsupportedFormatError } from "@/lib/extract-text";
import type { ExtractionResult } from "@/lib/extract-text";
import { uploadMaterialFile } from "@/services/materials";
import { useUserId } from "@/hooks/use-auth";
import { toMessage } from "@/lib/supabase";
import type { MaterialInput } from "@/services/materials";
import type { CourseSection, MaterialType, StudyMaterial } from "@/types/database";

interface MaterialFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string;
  sections: CourseSection[];
  material?: StudyMaterial | null;
  defaultSectionId?: string | null;
  onSubmit: (input: MaterialInput) => Promise<unknown>;
  submitting?: boolean;
}

const NO_SECTION = "__none__";

export function MaterialFormDialog({
  open, onOpenChange, courseId, sections, material, defaultSectionId, onSubmit, submitting,
}: MaterialFormDialogProps) {
  const userId = useUserId();
  const fileInput = useRef<HTMLInputElement>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  // Texte tiré du document importé. Il alimente `processed_content`, que la
  // génération lit en priorité sur le champ Contenu.
  const [extraction, setExtraction] = useState<ExtractionResult | null>(null);
  const [extractionNote, setExtractionNote] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<MaterialType>("text");
  const [sectionId, setSectionId] = useState<string>(NO_SECTION);
  const [source, setSource] = useState("");
  const [content, setContent] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle(material?.title ?? "");
    setType(material?.type ?? "text");
    setSectionId(material?.section_id ?? defaultSectionId ?? NO_SECTION);
    setSource(material?.source ?? "");
    setContent(material?.raw_content ?? "");
    setFileUrl(material?.file_url ?? null);
    setFileName(material?.file_url ? material.file_url.split("/").pop() ?? null : null);
    setExtraction(
      material?.processed_content
        ? { text: material.processed_content, truncated: false }
        : null,
    );
    setExtractionNote(null);
  }, [open, material, defaultSectionId]);

  function forgetFile() {
    setFileUrl(null);
    setFileName(null);
    setExtraction(null);
    setExtractionNote(null);
  }

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploading(true);
    try {
      const path = await uploadMaterialFile(userId, courseId, file);
      setFileUrl(path);
      setFileName(file.name);
      if (!title.trim()) setTitle(file.name.replace(/\.[^.]+$/, ""));
      if (type === "text") setType(file.type === "application/pdf" ? "pdf" : "document");
      toast.success("Document importé.");
    } catch (error) {
      toast.error(toMessage(error));
      setUploading(false);
      return;
    }
    setUploading(false);

    // L'extraction est distincte de l'import : un document dont le texte n'est
    // pas récupérable reste une pièce jointe valable, il faut alors coller le
    // texte à la main comme avant.
    setExtracting(true);
    setExtraction(null);
    setExtractionNote(null);
    try {
      const result = await extractText(file);
      if (result.text) {
        setExtraction(result);
        toast.success("Texte du document extrait.");
      } else {
        setExtractionNote(
          "Aucun texte trouvé : le document est probablement scanné (image). " +
            "Colle son texte dans le champ Contenu.",
        );
      }
    } catch (error) {
      setExtractionNote(
        error instanceof UnsupportedFormatError ? error.message : toMessage(error),
      );
    } finally {
      setExtracting(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    await onSubmit({
      title: title.trim(),
      type,
      section_id: sectionId === NO_SECTION ? null : sectionId,
      source: source.trim() || null,
      raw_content: content,
      processed_content: extraction?.text ?? null,
      file_url: fileUrl,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{material ? "Modifier le contenu" : "Ajouter du contenu"}</DialogTitle>
          <DialogDescription>
            Colle tes notes ou le texte du cours, ou importe un document : c'est ce texte — et
            lui seul — qui sert de base aux générations de Claude.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="material-title">Titre *</Label>
              <Input
                id="material-title"
                required
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Notes du cours magistral"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={type} onValueChange={(value) => setType(value as MaterialType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(MATERIAL_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Chapitre</Label>
              <Select value={sectionId} onValueChange={setSectionId}>
                <SelectTrigger><SelectValue placeholder="Aucun chapitre" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_SECTION}>Cours entier</SelectItem>
                  {sections.map((section) => (
                    <SelectItem key={section.id} value={section.id}>{section.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="material-source">Source</Label>
              <Input
                id="material-source"
                value={source}
                onChange={(event) => setSource(event.target.value)}
                placeholder="Diapositives, manuel, notes…"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="material-content">Contenu</Label>
            <Textarea
              id="material-content"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="Colle ici le texte du cours…"
              className="min-h-[220px] font-mono text-[13px] leading-relaxed"
            />
            <p className="text-xs text-muted-foreground">
              {content.trim().length.toLocaleString("fr-FR")} caractères
            </p>
          </div>

          {/* Import de document : le fichier est stocké dans un bucket privé.
              Claude ne lit que le texte ci-dessus, jamais le binaire. */}
          <div className="space-y-2">
            <Label>Document joint</Label>
            {fileUrl ? (
              <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
                <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-sm">{fileName ?? "Document"}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  aria-label="Retirer le document"
                  onClick={forgetFile}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={uploading}
                onClick={() => fileInput.current?.click()}
              >
                {uploading ? <Loader2 className="animate-spin" /> : <FileUp />}
                {uploading ? "Import en cours…" : "Importer un document (PDF, Word, image…)"}
              </Button>
            )}
            <input
              ref={fileInput}
              type="file"
              hidden
              accept=".pdf,.txt,.md,.doc,.docx,.pptx,.png,.jpg,.jpeg"
              onChange={handleFile}
            />
            {extracting ? (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Extraction du texte…
              </p>
            ) : null}

            {extraction && !extracting ? (
              <p className="flex items-start gap-2 rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-xs text-muted-foreground">
                <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                <span>
                  Texte extrait
                  {extraction.pages ? ` de ${extraction.pages} page${extraction.pages > 1 ? "s" : ""}` : ""}
                  {" "}({extraction.text.length.toLocaleString("fr-FR")} caractères)
                  {extraction.truncated ? ", tronqué à la limite exploitable" : ""}.
                  {" "}C'est lui qui servira aux générations, à la place du champ Contenu.
                </span>
              </p>
            ) : null}

            {extractionNote && !extracting ? (
              <p className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-muted-foreground">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
                <span>{extractionNote}</span>
              </p>
            ) : null}

            <p className="text-xs text-muted-foreground">
              Le fichier est conservé en pièce jointe privée. Le texte des PDF et des fichiers
              texte est extrait automatiquement ; pour les autres formats, colle-le dans le champ
              ci-dessus.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" loading={submitting}>
              {material ? "Enregistrer" : "Ajouter"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
