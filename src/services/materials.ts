import { supabase } from "@/lib/supabase";
import type { StudyMaterial, StudySummary } from "@/types/database";

export interface MaterialInput {
  title: string;
  type: StudyMaterial["type"];
  raw_content?: string | null;
  processed_content?: string | null;
  section_id?: string | null;
  source?: string | null;
  file_url?: string | null;
}

export async function listMaterials(courseId: string): Promise<StudyMaterial[]> {
  const { data, error } = await supabase
    .from("study_materials")
    .select("*")
    .eq("course_id", courseId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as StudyMaterial[];
}

export async function createMaterial(
  userId: string,
  courseId: string,
  input: MaterialInput,
): Promise<StudyMaterial> {
  const { data, error } = await supabase
    .from("study_materials")
    .insert({
      user_id: userId,
      course_id: courseId,
      section_id: input.section_id ?? null,
      title: input.title,
      type: input.type,
      raw_content: input.raw_content ?? null,
      processed_content: input.processed_content ?? null,
      source: input.source ?? null,
      file_url: input.file_url ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as StudyMaterial;
}

export async function updateMaterial(
  materialId: string,
  input: Partial<MaterialInput>,
): Promise<StudyMaterial> {
  const { data, error } = await supabase
    .from("study_materials")
    .update(input)
    .eq("id", materialId)
    .select("*")
    .single();
  if (error) throw error;
  return data as StudyMaterial;
}

export async function deleteMaterial(materialId: string): Promise<void> {
  const { error } = await supabase.from("study_materials").delete().eq("id", materialId);
  if (error) throw error;
}

export async function listSummaries(courseId: string): Promise<StudySummary[]> {
  const { data, error } = await supabase
    .from("study_summaries")
    .select("*")
    .eq("course_id", courseId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as StudySummary[];
}

export async function deleteSummary(summaryId: string): Promise<void> {
  const { error } = await supabase.from("study_summaries").delete().eq("id", summaryId);
  if (error) throw error;
}

/** Upload d'un document dans le bucket privé `materials`. */
export async function uploadMaterialFile(userId: string, courseId: string, file: File): Promise<string> {
  const path = `${userId}/${courseId}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
  const { error } = await supabase.storage.from("materials").upload(path, file, { upsert: false });
  if (error) throw error;
  return path;
}

export async function getMaterialFileUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from("materials").createSignedUrl(path, 3600);
  if (error) return null;
  return data?.signedUrl ?? null;
}
