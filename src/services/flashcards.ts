import { supabase } from "@/lib/supabase";
import { INITIAL_STATE, scheduleReview, type ReviewGrade, type SchedulingState } from "@/lib/sm2";
import type { Flashcard, FlashcardProgress, StudyCard } from "@/types/database";

export interface FlashcardInput {
  question: string;
  answer: string;
  explanation?: string | null;
  difficulty: Flashcard["difficulty"];
  topic?: string | null;
  section_id?: string | null;
}

export interface FlashcardWithProgress extends Flashcard {
  progress: FlashcardProgress | null;
}

export async function listFlashcards(
  courseId: string,
  sectionId?: string | null,
): Promise<FlashcardWithProgress[]> {
  let query = supabase
    .from("flashcards")
    .select("*, progress:flashcard_progress(*)")
    .eq("course_id", courseId)
    .eq("archived", false)
    .order("created_at", { ascending: false });

  if (sectionId) query = query.eq("section_id", sectionId);

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((row) => {
    const { progress, ...card } = row as Flashcard & { progress: FlashcardProgress[] };
    return { ...card, progress: progress?.[0] ?? null };
  });
}

export async function createFlashcard(
  userId: string,
  courseId: string,
  input: FlashcardInput,
): Promise<Flashcard> {
  const { data, error } = await supabase
    .from("flashcards")
    .insert({
      user_id: userId,
      course_id: courseId,
      section_id: input.section_id ?? null,
      question: input.question,
      answer: input.answer,
      explanation: input.explanation ?? null,
      difficulty: input.difficulty,
      topic: input.topic ?? null,
      created_by: "manual" as const,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Flashcard;
}

export async function updateFlashcard(
  cardId: string,
  input: Partial<FlashcardInput>,
): Promise<Flashcard> {
  const { data, error } = await supabase
    .from("flashcards")
    .update(input)
    .eq("id", cardId)
    .select("*")
    .single();
  if (error) throw error;
  return data as Flashcard;
}

export async function deleteFlashcard(cardId: string): Promise<void> {
  const { error } = await supabase.from("flashcards").delete().eq("id", cardId);
  if (error) throw error;
}

/** Cartes dues aujourd'hui (moteur SM-2, aucun appel IA). */
export async function getDueCards(params: {
  courseId?: string | null;
  sectionIds?: string[] | null;
  limit?: number;
  includeNew?: boolean;
}): Promise<StudyCard[]> {
  const { data, error } = await supabase.rpc("get_due_flashcards", {
    p_course_id: params.courseId ?? null,
    p_section_ids: params.sectionIds?.length ? params.sectionIds : null,
    p_limit: params.limit ?? 50,
    p_include_new: params.includeNew ?? true,
  });
  if (error) throw error;
  return (data ?? []) as StudyCard[];
}

/** Session « Révision avant examen » construite côté base de données. */
export async function getExamSessionCards(examId: string, limit = 30): Promise<StudyCard[]> {
  const { data, error } = await supabase.rpc("build_exam_session", {
    p_exam_id: examId,
    p_limit: limit,
  });
  if (error) throw error;
  return (data ?? []) as StudyCard[];
}

export async function getProgressFor(cardIds: string[]): Promise<Map<string, FlashcardProgress>> {
  if (cardIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from("flashcard_progress")
    .select("*")
    .in("flashcard_id", cardIds);
  if (error) throw error;
  return new Map((data ?? []).map((row) => [(row as FlashcardProgress).flashcard_id, row as FlashcardProgress]));
}

/**
 * Enregistre une révision : calcule le nouvel état SM-2 puis le persiste.
 * Retourne l'état mis à jour pour un affichage immédiat.
 */
export async function recordReview(params: {
  userId: string;
  cardId: string;
  grade: ReviewGrade;
  current?: SchedulingState | null;
}): Promise<FlashcardProgress> {
  const next = scheduleReview(params.current ?? INITIAL_STATE, params.grade);

  const { data, error } = await supabase
    .from("flashcard_progress")
    .upsert(
      {
        user_id: params.userId,
        flashcard_id: params.cardId,
        repetitions: next.repetitions,
        ease_factor: next.ease_factor,
        interval_days: next.interval_days,
        next_review_at: next.next_review_at,
        last_reviewed_at: next.last_reviewed_at,
        status: next.status,
        correct_count: next.correct_count,
        incorrect_count: next.incorrect_count,
        lapses: next.lapses,
      },
      { onConflict: "user_id,flashcard_id" },
    )
    .select("*")
    .single();

  if (error) throw error;
  return data as FlashcardProgress;
}
