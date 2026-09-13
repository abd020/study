import { supabase } from "@/lib/supabase";
import type { Course, CourseOverview } from "@/types/database";

export type CourseInput = Omit<
  Course,
  "id" | "user_id" | "created_at" | "updated_at" | "archived"
> & { archived?: boolean };

export async function listCourses(includeArchived = false): Promise<CourseOverview[]> {
  let query = supabase.from("course_overview").select("*").order("created_at", { ascending: false });
  if (!includeArchived) query = query.eq("archived", false);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as CourseOverview[];
}

export async function getCourse(courseId: string): Promise<CourseOverview> {
  const { data, error } = await supabase
    .from("course_overview")
    .select("*")
    .eq("id", courseId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Cours introuvable.");
  return data as CourseOverview;
}

export async function createCourse(userId: string, input: CourseInput): Promise<Course> {
  const { data, error } = await supabase
    .from("courses")
    .insert({ ...input, user_id: userId })
    .select("*")
    .single();
  if (error) throw error;
  return data as Course;
}

export async function updateCourse(courseId: string, input: Partial<CourseInput>): Promise<Course> {
  const { data, error } = await supabase
    .from("courses")
    .update(input)
    .eq("id", courseId)
    .select("*")
    .single();
  if (error) throw error;
  return data as Course;
}

export async function deleteCourse(courseId: string): Promise<void> {
  const { error } = await supabase.from("courses").delete().eq("id", courseId);
  if (error) throw error;
}
