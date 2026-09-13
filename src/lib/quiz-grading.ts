import type { QuestionType } from "@/types/database";

/** Le minimum nécessaire pour corriger une réponse. */
export interface GradableQuestion {
  question_type: QuestionType;
  correct_answer: string;
}

/**
 * Compare la réponse de l'utilisateur à la bonne réponse.
 *
 * Choix multiple et vrai/faux : comparaison exacte après normalisation.
 * Réponse courte : on tolère la casse, les accents et la ponctuation, mais
 * pas les réponses partielles — « r » ne doit pas valider « VP = C / r ».
 */
const STOP_WORDS = new Set([
  "le", "la", "les", "un", "une", "des", "de", "du", "d", "l", "et", "ou",
  "a", "au", "aux", "en", "est", "sont", "the", "of",
]);

function normalizeAnswer(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // accents
    .replace(/[^\p{L}\p{N}\s]/gu, " ") // ponctuation et symboles
    .replace(/\s+/g, " ")
    .trim();
}

function significantWords(value: string): string[] {
  return normalizeAnswer(value)
    .split(" ")
    .filter((word) => word.length > 0 && !STOP_WORDS.has(word));
}

export function checkAnswer(question: GradableQuestion, userAnswer: string): boolean {
  const expected = normalizeAnswer(question.correct_answer);
  const given = normalizeAnswer(userAnswer);

  if (given.length === 0) return false;
  if (given === expected) return true;
  if (question.question_type !== "short_answer") return false;

  // Réponse courte : tous les mots porteurs de sens doivent être présents,
  // dans n'importe quel ordre.
  const expectedWords = significantWords(question.correct_answer);
  const givenWords = new Set(significantWords(userAnswer));
  if (expectedWords.length === 0) return false;

  return expectedWords.every((word) => givenWords.has(word));
}
