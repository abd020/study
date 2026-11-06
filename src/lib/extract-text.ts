/**
 * Extraction du texte des documents importés.
 *
 * Le résultat alimente `processed_content`, que l'Edge Function lit en priorité
 * sur `raw_content` (voir `supabase/functions/generate-study-material`). Sans
 * cette étape, un PDF importé est bien stocké dans le bucket `materials` mais
 * reste invisible pour la génération de flashcards, de quiz et de résumés :
 * il fallait recopier le texte à la main.
 *
 * L'extraction se fait dans le navigateur, au moment de l'import : le fichier
 * est déjà en mémoire, et aucune Edge Function supplémentaire n'est à déployer.
 */

/** Au-delà, l'Edge Function tronque de toute façon (MAX_MATERIAL_CHARS). */
export const MAX_EXTRACTED_CHARS = 120_000;

export interface ExtractionResult {
  text: string;
  /** Vrai si le document dépassait la limite exploitable et a été coupé. */
  truncated: boolean;
  /** Nombre de pages, pour les formats paginés. */
  pages?: number;
}

/** Format reconnu mais dont le texte ne peut pas être extrait ici. */
export class UnsupportedFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsupportedFormatError";
  }
}

function hasExtension(file: File, ...extensions: string[]): boolean {
  const name = file.name.toLowerCase();
  return extensions.some((extension) => name.endsWith(extension));
}

/** Espaces et sauts de ligne en excès : les PDF en produisent beaucoup. */
function normalize(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function finalize(raw: string, pages?: number): ExtractionResult {
  const text = normalize(raw);
  return {
    text: text.slice(0, MAX_EXTRACTED_CHARS),
    truncated: text.length > MAX_EXTRACTED_CHARS,
    pages,
  };
}

async function extractPdf(file: File): Promise<ExtractionResult> {
  // pdf.js pèse plusieurs centaines de kilo-octets : il n'est chargé qu'ici,
  // au premier PDF importé, et reste hors du bundle initial.
  const [pdfjs, worker] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

  const task = pdfjs.getDocument({ data: await file.arrayBuffer() });
  const document = await task.promise;
  try {
    const pages: string[] = [];
    for (let number = 1; number <= document.numPages; number += 1) {
      const page = await document.getPage(number);
      const content = await page.getTextContent();
      // Les fragments sont positionnés, pas ordonnés en lignes : `hasEOL`
      // marque les fins de ligne, sans quoi tout le texte se retrouve collé.
      pages.push(
        content.items
          .map((item) => ("str" in item ? item.str + (item.hasEOL ? "\n" : "") : ""))
          .join(""),
      );
      page.cleanup();
    }
    return finalize(pages.join("\n\n"), document.numPages);
  } finally {
    await task.destroy();
  }
}

/**
 * Extrait le texte d'un fichier importé.
 *
 * @throws {UnsupportedFormatError} pour un format sans extraction possible
 *   (images sans OCR, Word, PowerPoint) — l'appelant doit alors inviter à
 *   coller le texte à la main plutôt que traiter l'import comme un échec.
 */
export async function extractText(file: File): Promise<ExtractionResult> {
  if (file.type === "application/pdf" || hasExtension(file, ".pdf")) {
    return extractPdf(file);
  }

  if (file.type.startsWith("text/") || hasExtension(file, ".txt", ".md", ".markdown")) {
    return finalize(await file.text());
  }

  if (file.type.startsWith("image/")) {
    throw new UnsupportedFormatError(
      "Le texte des images n'est pas reconnu. Colle-le dans le champ Contenu.",
    );
  }

  throw new UnsupportedFormatError(
    "Ce format ne permet pas d'extraire le texte automatiquement. " +
      "Colle-le dans le champ Contenu, ou réimporte le document en PDF.",
  );
}
