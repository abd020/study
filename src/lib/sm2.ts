/**
 * Moteur de répétition espacée — algorithme inspiré de SM-2 (SuperMemo 2).
 *
 * Entièrement côté application : aucune dépendance à Claude ni à un service
 * externe. Une révision produit un nouvel état (répétitions, facteur de
 * facilité, intervalle, prochaine date) à partir de l'état précédent et de la
 * qualité de rappel choisie par l'utilisateur.
 */

import type { CardStatus } from "@/types/database";

/** Les quatre boutons affichés sous une carte. */
export type ReviewGrade = "again" | "hard" | "good" | "easy";

export const REVIEW_GRADES: {
  grade: ReviewGrade;
  label: string;
  hint: string;
  quality: number;
}[] = [
  { grade: "again", label: "Encore", hint: "Je ne savais pas", quality: 1 },
  { grade: "hard", label: "Difficile", hint: "Retrouvé avec peine", quality: 3 },
  { grade: "good", label: "Bien", hint: "Correct", quality: 4 },
  { grade: "easy", label: "Facile", hint: "Immédiat", quality: 5 },
];

export interface SchedulingState {
  repetitions: number;
  ease_factor: number;
  interval_days: number;
  status: CardStatus;
  correct_count: number;
  incorrect_count: number;
  lapses: number;
}

export interface SchedulingResult extends SchedulingState {
  next_review_at: string;
  last_reviewed_at: string;
}

export const INITIAL_STATE: SchedulingState = {
  repetitions: 0,
  ease_factor: 2.5,
  interval_days: 0,
  status: "new",
  correct_count: 0,
  incorrect_count: 0,
  lapses: 0,
};

const MIN_EASE = 1.3;
const MAX_EASE = 3.0;
const LEARNING_STEPS_DAYS = [10 / 1440, 1]; // 10 minutes, puis 1 jour
const MASTERY_INTERVAL_DAYS = 21;
const MASTERY_REPETITIONS = 4;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function clampEase(value: number): number {
  return round2(Math.min(MAX_EASE, Math.max(MIN_EASE, value)));
}

/**
 * Applique une révision et renvoie le nouvel état de planification.
 *
 * - « Encore » réinitialise le compteur de répétitions et replace la carte
 *   en apprentissage (intervalle court), en incrémentant les rechutes.
 * - « Difficile » allonge peu l'intervalle et baisse le facteur de facilité.
 * - « Bien » suit la progression standard SM-2.
 * - « Facile » applique un bonus multiplicatif.
 */
export function scheduleReview(
  state: SchedulingState = INITIAL_STATE,
  grade: ReviewGrade,
  now: Date = new Date(),
): SchedulingResult {
  const quality = REVIEW_GRADES.find((g) => g.grade === grade)?.quality ?? 4;
  const wasReviewed = state.repetitions > 0 || state.status !== "new";

  let { repetitions, ease_factor, interval_days, lapses } = state;
  let correct_count = state.correct_count;
  let incorrect_count = state.incorrect_count;

  // Ajustement du facteur de facilité (formule SM-2).
  ease_factor = clampEase(
    ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)),
  );

  if (grade === "again") {
    incorrect_count += 1;
    repetitions = 0;
    if (wasReviewed) lapses += 1;
    interval_days = LEARNING_STEPS_DAYS[0];
  } else {
    correct_count += 1;
    repetitions += 1;

    if (repetitions === 1) {
      interval_days = grade === "easy" ? 1 : LEARNING_STEPS_DAYS[0];
    } else if (repetitions === 2) {
      interval_days = grade === "easy" ? 4 : LEARNING_STEPS_DAYS[1];
    } else {
      const base = Math.max(interval_days, LEARNING_STEPS_DAYS[1]);
      const multiplier = grade === "hard" ? 1.2 : grade === "easy" ? ease_factor * 1.3 : ease_factor;
      interval_days = base * multiplier;
    }
  }

  interval_days = round2(Math.min(interval_days, 365));

  const status: CardStatus =
    grade === "again"
      ? wasReviewed
        ? "lapsed"
        : "learning"
      : repetitions >= MASTERY_REPETITIONS && interval_days >= MASTERY_INTERVAL_DAYS
      ? "mastered"
      : repetitions >= 2
      ? "review"
      : "learning";

  const nextReview = new Date(now.getTime() + interval_days * 86_400_000);

  return {
    repetitions,
    ease_factor,
    interval_days,
    status,
    correct_count,
    incorrect_count,
    lapses,
    next_review_at: nextReview.toISOString(),
    last_reviewed_at: now.toISOString(),
  };
}

/** Aperçu « dans combien de temps » affiché sur chaque bouton de révision. */
export function previewInterval(state: SchedulingState, grade: ReviewGrade): string {
  const { interval_days } = scheduleReview(state, grade);
  if (interval_days < 1) {
    const minutes = Math.max(1, Math.round(interval_days * 1440));
    return `${minutes} min`;
  }
  if (interval_days < 30) return `${Math.round(interval_days)} j`;
  if (interval_days < 365) return `${Math.round(interval_days / 30)} mois`;
  return `${Math.round(interval_days / 365)} an`;
}
