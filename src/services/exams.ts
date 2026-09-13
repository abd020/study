import { supabase } from "@/lib/supabase";
import type { Exam, ExamReadiness, ExamWithCourse } from "@/types/database";

export interface ExamInput {
  course_id: string;
  title: string;
  exam_type: Exam["exam_type"];
  exam_date: string;
  start_time?: string | null;
  end_time?: string | null;
  location?: string | null;
  description?: string | null;
  weight_percentage?: number | null;
}

const SELECT = "*, course:courses(id, name, color, code)";

export async function listExams(options: { upcomingOnly?: boolean; courseId?: string } = {}): Promise<ExamWithCourse[]> {
  let query = supabase.from("exams").select(SELECT).order("exam_date", { ascending: true });
  if (options.upcomingOnly) query = query.gte("exam_date", new Date().toISOString().slice(0, 10));
  if (options.courseId) query = query.eq("course_id", options.courseId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ExamWithCourse[];
}

export async function getExam(examId: string): Promise<ExamWithCourse> {
  const { data, error } = await supabase.from("exams").select(SELECT).eq("id", examId).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Examen introuvable.");
  return data as ExamWithCourse;
}

export async function createExam(userId: string, input: ExamInput, sectionIds: string[] = []): Promise<Exam> {
  const { data, error } = await supabase
    .from("exams")
    .insert({ ...input, user_id: userId })
    .select("*")
    .single();
  if (error) throw error;

  if (sectionIds.length > 0) {
    const { error: linkError } = await supabase
      .from("exam_sections")
      .insert(sectionIds.map((section_id) => ({ exam_id: data.id, section_id })));
    if (linkError) throw linkError;
  }
  return data as Exam;
}

export async function updateExam(
  examId: string,
  input: Partial<ExamInput>,
  sectionIds?: string[],
): Promise<Exam> {
  const { data, error } = await supabase
    .from("exams")
    .update(input)
    .eq("id", examId)
    .select("*")
    .single();
  if (error) throw error;

  if (sectionIds) {
    await supabase.from("exam_sections").delete().eq("exam_id", examId);
    if (sectionIds.length > 0) {
      const { error: linkError } = await supabase
        .from("exam_sections")
        .insert(sectionIds.map((section_id) => ({ exam_id: examId, section_id })));
      if (linkError) throw linkError;
    }
  }
  return data as Exam;
}

export async function deleteExam(examId: string): Promise<void> {
  const { error } = await supabase.from("exams").delete().eq("id", examId);
  if (error) throw error;
}

export async function getExamSectionIds(examId: string): Promise<string[]> {
  const { data, error } = await supabase.from("exam_sections").select("section_id").eq("exam_id", examId);
  if (error) throw error;
  return (data ?? []).map((row) => (row as { section_id: string }).section_id);
}

/** Niveau de préparation calculé en base : aucun appel IA. */
export async function getExamReadiness(examId: string): Promise<ExamReadiness> {
  const { data, error } = await supabase.rpc("get_exam_readiness", { p_exam_id: examId });
  if (error) throw error;
  return data as ExamReadiness;
}
