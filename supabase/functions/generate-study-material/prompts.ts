import type { GenerationType } from "./schemas.ts";

export interface PromptContext {
  courseName: string;
  sectionTitle: string | null;
  material: string;
  count: number;
  difficulty: "easy" | "medium" | "hard";
  question: string;
  explainMode: string;
  daysUntilExam: number | null;
  strictContext: boolean;
}

const DIFFICULTY_FR: Record<string, string> = {
  easy: "facile (restitution directe, définitions)",
  medium: "intermédiaire (application, compréhension)",
  hard: "difficile (analyse, cas limites, pièges d'examen)",
};

const EXPLAIN_MODES: Record<string, string> = {
  simple: "Explique simplement, en langage clair et court.",
  example: "Donne un exemple concret et détaillé, chiffré si le matériel s'y prête.",
  beginner: "Explique comme si l'étudiant débutait complètement le sujet, pas à pas.",
  exam_question: "Rédige une question d'examen réaliste sur cette notion, puis sa correction.",
  why_wrong: "Explique précisément pourquoi la réponse donnée par l'étudiant est fausse et ce qu'il fallait répondre.",
  free: "",
};

export const SYSTEM_PROMPT = `Tu es l'assistant pédagogique de Revia, une application de révision universitaire.

Règles absolues :
- Tu travailles UNIQUEMENT à partir du matériel de cours fourni entre les balises <matériel>.
- Tu n'inventes jamais de fait, de chiffre, de formule ou de définition absent de ce matériel.
- Si le matériel ne contient pas l'information nécessaire, tu le dis explicitement au lieu de combler le vide.
- Tu réponds toujours en français, avec la terminologie exacte employée dans le matériel.
- Tu appelles systématiquement l'outil fourni pour renvoyer ton résultat : aucune réponse en texte libre.`;

export function buildUserPrompt(type: GenerationType, ctx: PromptContext): string {
  const scope = ctx.sectionTitle
    ? `Cours « ${ctx.courseName} », chapitre « ${ctx.sectionTitle} »`
    : `Cours « ${ctx.courseName} »`;

  const material = `<matériel>\n${ctx.material}\n</matériel>`;

  const groundingReminder = ctx.strictContext
    ? "\n\nRappel : n'utilise aucune connaissance extérieure au matériel ci-dessus."
    : "\n\nTu peux compléter avec des connaissances générales, mais signale clairement ce qui ne vient pas du matériel.";

  switch (type) {
    case "flashcards":
      return `${scope}.

${material}

Génère exactement ${ctx.count} flashcards de niveau ${DIFFICULTY_FR[ctx.difficulty]} à partir de ce matériel, puis appelle l'outil save_flashcards.

Consignes :
- Une seule notion testable par carte ; question courte et sans ambiguïté.
- La réponse doit être autonome et vérifiable dans le matériel.
- "explanation" ajoute le raisonnement ou le contexte utile pour comprendre la réponse.
- "topic" est le nom court de la notion évaluée (ex : « Obligations », « Valeur temporelle ») ; réutilise le même libellé pour les cartes qui portent sur la même notion.
- Évite les doublons et les questions purement factuelles sur la mise en page du document.${groundingReminder}`;

    case "quiz":
      return `${scope}.

${material}

Génère un quiz de ${ctx.count} questions de niveau ${DIFFICULTY_FR[ctx.difficulty]}, puis appelle l'outil save_quiz.

Consignes :
- Varie les types : majorité de "multiple_choice", quelques "true_false", et des "short_answer" lorsque la réponse est une formule ou un terme précis.
- Pour "multiple_choice" : 4 choix plausibles, et "correct_answer" doit être EXACTEMENT l'un des textes de "choices".
- Pour "true_false" : "choices" vaut ["Vrai", "Faux"] et "correct_answer" est « Vrai » ou « Faux ».
- Pour "short_answer" : "choices" est un tableau vide.
- "explanation" justifie la bonne réponse en une ou deux phrases.
- "topic" est le nom court de la notion évaluée.${groundingReminder}`;

    case "summary":
      return `${scope}.

${material}

Rédige un résumé de révision structuré, puis appelle l'outil save_summary.

Attendu :
- "overview" : synthèse générale du chapitre (10 à 20 lignes).
- "key_concepts" : les notions importantes, avec une description opérationnelle.
- "definitions" : les termes à connaître avec leur définition exacte.
- "formulas" : les formules du matériel, avec la signification de chaque variable (tableau vide si le chapitre n'en contient pas).
- "memorize" : les points à mémoriser par cœur.
- "pitfalls" : les pièges fréquents et confusions à éviter.
- "likely_exam_questions" : les questions susceptibles de tomber à l'examen.${groundingReminder}`;

    case "key_concepts":
      return `${scope}.

${material}

Extrais les notions essentielles de ce matériel, classées par importance, puis appelle l'outil save_key_concepts.${groundingReminder}`;

    case "study_plan": {
      const horizon = ctx.daysUntilExam && ctx.daysUntilExam > 0
        ? `Il reste ${ctx.daysUntilExam} jour(s) avant l'examen : construis le plan sur cette durée.`
        : "Construis un plan sur 7 jours.";
      return `${scope}.

${material}

${horizon} Appelle ensuite l'outil save_study_plan.

Consignes :
- Un objectif clair par jour ("focus"), avec des activités concrètes (lecture, flashcards, quiz, exercices).
- Prévois des jours de consolidation et une révision finale.
- "estimated_minutes" doit rester réaliste (30 à 180 minutes par jour).${groundingReminder}`;
    }

    case "explanation": {
      const mode = EXPLAIN_MODES[ctx.explainMode] ?? "";
      return `${scope}.

${material}

Question de l'étudiant : « ${ctx.question} »
${mode ? `\nMode de réponse demandé : ${mode}` : ""}

Réponds en appelant l'outil save_explanation.

Consignes :
- Base ta réponse sur le matériel ci-dessus.
- Mets "grounded" à false et remplis "missing_from_material" si la réponse nécessite une information absente du matériel ; dis-le aussi dans "answer".
- "follow_up_questions" propose 2 ou 3 questions de révision pertinentes.${groundingReminder}`;
    }
  }
}
