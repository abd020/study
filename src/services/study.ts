import { supabase } from "@/lib/supabase";
import type {
  DashboardSummary,
  ProgressOverview,
  SessionType,
  StudySession,
  WeakTopic,
} from "@/types/database";

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const { data, error } = await supabase.rpc("get_dashboard_summary");
  if (error) throw error;
  return data as DashboardSummary;
}

export async function getProgressOverview(days = 30): Promise<ProgressOverview> {
  const { data, error } = await supabase.rpc("get_progress_overview", { p_days: days });
  if (error) throw error;
  return data as ProgressOverview;
}

export async function getWeakTopics(courseId?: string | null, limit = 12): Promise<WeakTopic[]> {
  const { data, error } = await supabase.rpc("get_weak_topics", {
    p_course_id: courseId ?? null,
    p_limit: limit,
  });
  if (error) throw error;
  return (data ?? []) as WeakTopic[];
}

export async function startSession(params: {
  userId: string;
  sessionType: SessionType;
  courseId?: string | null;
  examId?: string | null;
}): Promise<StudySession> {
  const { data, error } = await supabase
    .from("study_sessions")
    .insert({
      user_id: params.userId,
      session_type: params.sessionType,
      course_id: params.courseId ?? null,
      exam_id: params.examId ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as StudySession;
}

export async function endSession(params: {
  sessionId: string;
  durationSeconds: number;
  cardsReviewed?: number;
  questionsAnswered?: number;
  correctAnswers?: number;
}): Promise<StudySession> {
  const { data, error } = await supabase
    .from("study_sessions")
    .update({
      ended_at: new Date().toISOString(),
      duration_seconds: Math.max(0, Math.round(params.durationSeconds)),
      cards_reviewed: params.cardsReviewed ?? 0,
      questions_answered: params.questionsAnswered ?? 0,
      correct_answers: params.correctAnswers ?? 0,
    })
    .eq("id", params.sessionId)
    .select("*")
    .single();
  if (error) throw error;
  return data as StudySession;
}

export async function listRecentSessions(limit = 15): Promise<(StudySession & { course: { name: string; color: string } | null })[]> {
  const { data, error } = await supabase
    .from("study_sessions")
    .select("*, course:courses(name, color)")
    .not("ended_at", "is", null)
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as (StudySession & { course: { name: string; color: string } | null })[];
}
