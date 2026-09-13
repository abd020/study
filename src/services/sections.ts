import { supabase } from "@/lib/supabase";
import type { CourseSection } from "@/types/database";

export interface SectionInput {
  title: string;
  description?: string | null;
  position?: number;
}

export async function listSections(courseId: string): Promise<CourseSection[]> {
  const { data, error } = await supabase
    .from("course_sections")
    .select("*")
    .eq("course_id", courseId)
    .order("position", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CourseSection[];
}

export async function createSection(
  userId: string,
  courseId: string,
  input: SectionInput,
): Promise<CourseSection> {
  const { data, error } = await supabase
    .from("course_sections")
    .insert({
      user_id: userId,
      course_id: courseId,
      title: input.title,
      description: input.description ?? null,
      position: input.position ?? 0,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as CourseSection;
}

export async function updateSection(
  sectionId: string,
  input: Partial<SectionInput>,
): Promise<CourseSection> {
  const { data, error } = await supabase
    .from("course_sections")
    .update(input)
    .eq("id", sectionId)
    .select("*")
    .single();
  if (error) throw error;
  return data as CourseSection;
}

export async function deleteSection(sectionId: string): Promise<void> {
  const { error } = await supabase.from("course_sections").delete().eq("id", sectionId);
  if (error) throw error;
}

export async function reorderSections(sections: { id: string; position: number }[]): Promise<void> {
  await Promise.all(
    sections.map(({ id, position }) =>
      supabase.from("course_sections").update({ position }).eq("id", id),
    ),
  );
}
