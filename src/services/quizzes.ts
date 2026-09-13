import { supabase } from "@/lib/supabase";
import type { Quiz, QuizAnswer, QuizAttempt, QuizQuestion } from "@/types/database";

export interface QuizWithMeta extends Quiz {
  question_count: number;
  best_score: number | null;
  attempt_count: number;
  course_name: string | null;
  course_color: string | null;
  section_title: string | null;
}

export async function listQuizzes(courseId?: string): Promise<QuizWithMeta[]> {
  let query = supabase
    .from("quizzes")
    .select(
      "*, course:courses(name, color), section:course_sections(title), quiz_questions(id), quiz_attempts(score, total_questions, completed_at)",
    )
    .order("created_at", { ascending: false });
  if (courseId) query = query.eq("course_id", courseId);

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((row) => {
    const r = row as Quiz & {
      course: { name: string; color: string } | null;
      section: { title: string } | null;
      quiz_questions: { id: string }[];
      quiz_attempts: { score: number; total_questions: number; completed_at: string | null }[];
    };
    const completed = r.quiz_attempts?.filter((a) => a.completed_at) ?? [];
    const best = completed.length
      ? Math.max(...completed.map((a) => (a.total_questions ? Math.round((a.score * 100) / a.total_questions) : 0)))
      : null;

    return {
      ...(row as Quiz),
      question_count: r.quiz_questions?.length ?? 0,
      attempt_count: completed.length,
      best_score: best,
      course_name: r.course?.name ?? null,
      course_color: r.course?.color ?? null,
      section_title: r.section?.title ?? null,
    };
  });
}

export async function getQuiz(quizId: string): Promise<{ quiz: Quiz; questions: QuizQuestion[] }> {
  const [{ data: quiz, error: quizError }, { data: questions, error: questionsError }] = await Promise.all([
    supabase.from("quizzes").select("*").eq("id", quizId).maybeSingle(),
    supabase.from("quiz_questions").select("*").eq("quiz_id", quizId).order("position", { ascending: true }),
  ]);
  if (quizError) throw quizError;
  if (questionsError) throw questionsError;
  if (!quiz) throw new Error("Quiz introuvable.");
  return { quiz: quiz as Quiz, questions: (questions ?? []) as QuizQuestion[] };
}

export async function deleteQuiz(quizId: string): Promise<void> {
  const { error } = await supabase.from("quizzes").delete().eq("id", quizId);
  if (error) throw error;
}

export async function startAttempt(
  userId: string,
  quizId: string,
  totalQuestions: number,
): Promise<QuizAttempt> {
  const { data, error } = await supabase
    .from("quiz_attempts")
    .insert({ user_id: userId, quiz_id: quizId, total_questions: totalQuestions, score: 0 })
    .select("*")
    .single();
  if (error) throw error;
  return data as QuizAttempt;
}

export async function saveAnswer(params: {
  attemptId: string;
  questionId: string;
  userAnswer: string;
  isCorrect: boolean;
}): Promise<QuizAnswer> {
  const { data, error } = await supabase
    .from("quiz_answers")
    .upsert(
      {
        attempt_id: params.attemptId,
        question_id: params.questionId,
        user_answer: params.userAnswer,
        is_correct: params.isCorrect,
      },
      { onConflict: "attempt_id,question_id" },
    )
    .select("*")
    .single();
  if (error) throw error;
  return data as QuizAnswer;
}

export async function completeAttempt(attemptId: string, score: number): Promise<QuizAttempt> {
  const { data, error } = await supabase
    .from("quiz_attempts")
    .update({ score, completed_at: new Date().toISOString() })
    .eq("id", attemptId)
    .select("*")
    .single();
  if (error) throw error;
  return data as QuizAttempt;
}

export interface AttemptHistoryRow extends QuizAttempt {
  quiz: { id: string; title: string; course_id: string; course: { name: string; color: string } | null } | null;
}

export async function listAttempts(limit = 25): Promise<AttemptHistoryRow[]> {
  const { data, error } = await supabase
    .from("quiz_attempts")
    .select("*, quiz:quizzes(id, title, course_id, course:courses(name, color))")
    .not("completed_at", "is", null)
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as AttemptHistoryRow[];
}

/** La correction d'une réponse est une logique pure : voir @/lib/quiz-grading. */
export { checkAnswer } from "@/lib/quiz-grading";
