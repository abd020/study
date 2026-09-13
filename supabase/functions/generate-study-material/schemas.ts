/**
 * Schémas JSON stricts imposés à Claude (strict tool use) + validateurs
 * exécutés côté serveur. Rien n'est inséré en base sans avoir été validé ici.
 */

export type GenerationType =
  | "summary"
  | "flashcards"
  | "quiz"
  | "key_concepts"
  | "study_plan"
  | "explanation";

export const GENERATION_TYPES: GenerationType[] = [
  "summary",
  "flashcards",
  "quiz",
  "key_concepts",
  "study_plan",
  "explanation",
];

const DIFFICULTIES = ["easy", "medium", "hard"] as const;
const QUESTION_TYPES = ["multiple_choice", "true_false", "short_answer"] as const;

export type Difficulty = (typeof DIFFICULTIES)[number];

// ---------------------------------------------------------------------------
// Schémas d'outil (strict: true => arguments garantis conformes au schéma)
// ---------------------------------------------------------------------------

const stringArray = { type: "array", items: { type: "string" } };

export const TOOL_SCHEMAS: Record<
  GenerationType,
  { name: string; description: string; input_schema: Record<string, unknown> }
> = {
  flashcards: {
    name: "save_flashcards",
    description:
      "Enregistre les flashcards générées à partir du matériel de cours fourni.",
    input_schema: {
      type: "object",
      properties: {
        flashcards: {
          type: "array",
          items: {
            type: "object",
            properties: {
              question: { type: "string" },
              answer: { type: "string" },
              explanation: { type: "string" },
              difficulty: { type: "string", enum: DIFFICULTIES },
              topic: { type: "string" },
            },
            required: ["question", "answer", "explanation", "difficulty", "topic"],
            additionalProperties: false,
          },
        },
      },
      required: ["flashcards"],
      additionalProperties: false,
    },
  },

  quiz: {
    name: "save_quiz",
    description: "Enregistre un quiz généré à partir du matériel de cours fourni.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        questions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              question: { type: "string" },
              question_type: { type: "string", enum: QUESTION_TYPES },
              choices: stringArray,
              correct_answer: { type: "string" },
              explanation: { type: "string" },
              topic: { type: "string" },
              difficulty: { type: "string", enum: DIFFICULTIES },
            },
            required: [
              "question",
              "question_type",
              "choices",
              "correct_answer",
              "explanation",
              "topic",
              "difficulty",
            ],
            additionalProperties: false,
          },
        },
      },
      required: ["title", "questions"],
      additionalProperties: false,
    },
  },

  summary: {
    name: "save_summary",
    description:
      "Enregistre un résumé structuré du chapitre à partir du matériel fourni.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        overview: { type: "string" },
        key_concepts: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              description: { type: "string" },
            },
            required: ["name", "description"],
            additionalProperties: false,
          },
        },
        definitions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              term: { type: "string" },
              definition: { type: "string" },
            },
            required: ["term", "definition"],
            additionalProperties: false,
          },
        },
        formulas: {
          type: "array",
          items: {
            type: "object",
            properties: {
              expression: { type: "string" },
              meaning: { type: "string" },
            },
            required: ["expression", "meaning"],
            additionalProperties: false,
          },
        },
        memorize: stringArray,
        pitfalls: stringArray,
        likely_exam_questions: stringArray,
      },
      required: [
        "title",
        "overview",
        "key_concepts",
        "definitions",
        "formulas",
        "memorize",
        "pitfalls",
        "likely_exam_questions",
      ],
      additionalProperties: false,
    },
  },

  key_concepts: {
    name: "save_key_concepts",
    description: "Liste les notions essentielles du matériel fourni.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        concepts: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              description: { type: "string" },
              importance: { type: "string", enum: ["low", "medium", "high"] },
            },
            required: ["name", "description", "importance"],
            additionalProperties: false,
          },
        },
      },
      required: ["title", "concepts"],
      additionalProperties: false,
    },
  },

  study_plan: {
    name: "save_study_plan",
    description:
      "Construit un plan de révision jour par jour jusqu'à la date d'examen.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        overview: { type: "string" },
        days: {
          type: "array",
          items: {
            type: "object",
            properties: {
              day: { type: "integer" },
              focus: { type: "string" },
              activities: stringArray,
              estimated_minutes: { type: "integer" },
            },
            required: ["day", "focus", "activities", "estimated_minutes"],
            additionalProperties: false,
          },
        },
      },
      required: ["title", "overview", "days"],
      additionalProperties: false,
    },
  },

  explanation: {
    name: "save_explanation",
    description:
      "Répond à une question de l'utilisateur en s'appuyant uniquement sur le matériel de cours.",
    input_schema: {
      type: "object",
      properties: {
        answer: { type: "string" },
        grounded: {
          type: "boolean",
          description:
            "true si la réponse provient entièrement du matériel de cours fourni.",
        },
        missing_from_material: {
          type: "string",
          description:
            "Ce qui manque dans le matériel de cours, ou une chaîne vide si tout y était.",
        },
        follow_up_questions: stringArray,
      },
      required: ["answer", "grounded", "missing_from_material", "follow_up_questions"],
      additionalProperties: false,
    },
  },
};

// ---------------------------------------------------------------------------
// Validation serveur (ne jamais faire confiance à la sortie du modèle)
// ---------------------------------------------------------------------------

export class ValidationError extends Error {}

function str(value: unknown, field: string, { max = 4000, required = true } = {}): string {
  if (typeof value !== "string") {
    if (!required) return "";
    throw new ValidationError(`Champ « ${field} » manquant ou invalide.`);
  }
  const trimmed = value.trim();
  if (required && trimmed.length === 0) {
    throw new ValidationError(`Champ « ${field} » vide.`);
  }
  return trimmed.slice(0, max);
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

function arr(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) throw new ValidationError(`Champ « ${field} » invalide.`);
  return value;
}

export interface ValidatedFlashcard {
  question: string;
  answer: string;
  explanation: string;
  difficulty: Difficulty;
  topic: string;
}

export function validateFlashcards(input: unknown, max: number): ValidatedFlashcard[] {
  const raw = arr((input as Record<string, unknown>)?.flashcards, "flashcards");
  const cards = raw.slice(0, max).map((item, index) => {
    const c = item as Record<string, unknown>;
    return {
      question: str(c.question, `flashcards[${index}].question`, { max: 1000 }),
      answer: str(c.answer, `flashcards[${index}].answer`, { max: 2000 }),
      explanation: str(c.explanation, `flashcards[${index}].explanation`, {
        max: 2000,
        required: false,
      }),
      difficulty: oneOf(c.difficulty, DIFFICULTIES, "medium"),
      topic: str(c.topic, `flashcards[${index}].topic`, { max: 120, required: false }),
    };
  });
  if (cards.length === 0) throw new ValidationError("Aucune flashcard exploitable générée.");
  return cards;
}

export interface ValidatedQuestion {
  question: string;
  question_type: (typeof QUESTION_TYPES)[number];
  choices: string[];
  correct_answer: string;
  explanation: string;
  topic: string;
  difficulty: Difficulty;
}

export function validateQuiz(
  input: unknown,
  max: number,
): { title: string; questions: ValidatedQuestion[] } {
  const data = (input ?? {}) as Record<string, unknown>;
  const raw = arr(data.questions, "questions");

  const questions = raw.slice(0, max).map((item, index) => {
    const q = item as Record<string, unknown>;
    const type = oneOf(q.question_type, QUESTION_TYPES, "multiple_choice");
    let choices = Array.isArray(q.choices)
      ? q.choices.map((c) => String(c).trim()).filter(Boolean).slice(0, 8)
      : [];
    const correct = str(q.correct_answer, `questions[${index}].correct_answer`, { max: 500 });

    if (type === "true_false") {
      choices = ["Vrai", "Faux"];
      if (!choices.some((c) => c.toLowerCase() === correct.toLowerCase())) {
        throw new ValidationError(
          `Question ${index + 1} : la réponse d'une question vrai/faux doit être « Vrai » ou « Faux ».`,
        );
      }
    } else if (type === "multiple_choice") {
      if (choices.length < 2) {
        throw new ValidationError(`Question ${index + 1} : au moins deux choix sont requis.`);
      }
      if (!choices.includes(correct)) {
        throw new ValidationError(
          `Question ${index + 1} : la bonne réponse doit figurer parmi les choix proposés.`,
        );
      }
    } else {
      choices = [];
    }

    return {
      question: str(q.question, `questions[${index}].question`, { max: 1000 }),
      question_type: type,
      choices,
      correct_answer: correct,
      explanation: str(q.explanation, `questions[${index}].explanation`, {
        max: 2000,
        required: false,
      }),
      topic: str(q.topic, `questions[${index}].topic`, { max: 120, required: false }),
      difficulty: oneOf(q.difficulty, DIFFICULTIES, "medium"),
    };
  });

  if (questions.length === 0) throw new ValidationError("Aucune question exploitable générée.");

  return {
    title: str(data.title, "title", { max: 200, required: false }) || "Quiz généré",
    questions,
  };
}

export function validateSummary(input: unknown): Record<string, unknown> {
  const d = (input ?? {}) as Record<string, unknown>;
  const pair = (items: unknown, a: string, b: string) =>
    (Array.isArray(items) ? items : []).slice(0, 40).map((item) => {
      const o = (item ?? {}) as Record<string, unknown>;
      return { [a]: str(o[a], a, { max: 300, required: false }), [b]: str(o[b], b, { max: 1500, required: false }) };
    }).filter((o) => o[a]);
  const list = (items: unknown) =>
    (Array.isArray(items) ? items : [])
      .slice(0, 40)
      .map((i) => String(i).trim())
      .filter(Boolean);

  return {
    title: str(d.title, "title", { max: 200, required: false }) || "Résumé",
    overview: str(d.overview, "overview", { max: 6000 }),
    key_concepts: pair(d.key_concepts, "name", "description"),
    definitions: pair(d.definitions, "term", "definition"),
    formulas: pair(d.formulas, "expression", "meaning"),
    memorize: list(d.memorize),
    pitfalls: list(d.pitfalls),
    likely_exam_questions: list(d.likely_exam_questions),
  };
}

export function validateKeyConcepts(input: unknown): Record<string, unknown> {
  const d = (input ?? {}) as Record<string, unknown>;
  const concepts = (Array.isArray(d.concepts) ? d.concepts : [])
    .slice(0, 50)
    .map((item) => {
      const o = (item ?? {}) as Record<string, unknown>;
      return {
        name: str(o.name, "name", { max: 200, required: false }),
        description: str(o.description, "description", { max: 1500, required: false }),
        importance: oneOf(o.importance, ["low", "medium", "high"] as const, "medium"),
      };
    })
    .filter((c) => c.name);
  if (concepts.length === 0) throw new ValidationError("Aucune notion exploitable générée.");
  return {
    title: str(d.title, "title", { max: 200, required: false }) || "Notions clés",
    concepts,
  };
}

export function validateStudyPlan(input: unknown): Record<string, unknown> {
  const d = (input ?? {}) as Record<string, unknown>;
  const days = (Array.isArray(d.days) ? d.days : [])
    .slice(0, 60)
    .map((item, index) => {
      const o = (item ?? {}) as Record<string, unknown>;
      return {
        day: Number.isFinite(Number(o.day)) ? Number(o.day) : index + 1,
        focus: str(o.focus, "focus", { max: 300, required: false }),
        activities: (Array.isArray(o.activities) ? o.activities : [])
          .slice(0, 12)
          .map((a) => String(a).trim())
          .filter(Boolean),
        estimated_minutes: Math.min(600, Math.max(0, Number(o.estimated_minutes) || 0)),
      };
    })
    .filter((day) => day.focus);
  if (days.length === 0) throw new ValidationError("Plan de révision vide.");
  return {
    title: str(d.title, "title", { max: 200, required: false }) || "Plan de révision",
    overview: str(d.overview, "overview", { max: 3000, required: false }),
    days,
  };
}

export function validateExplanation(input: unknown): Record<string, unknown> {
  const d = (input ?? {}) as Record<string, unknown>;
  return {
    answer: str(d.answer, "answer", { max: 8000 }),
    grounded: d.grounded !== false,
    missing_from_material: str(d.missing_from_material, "missing_from_material", {
      max: 1000,
      required: false,
    }),
    follow_up_questions: (Array.isArray(d.follow_up_questions) ? d.follow_up_questions : [])
      .slice(0, 5)
      .map((q) => String(q).trim())
      .filter(Boolean),
  };
}
