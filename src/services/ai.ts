import { supabase } from "@/lib/supabase";
import type { AiGeneration, Difficulty, GenerationType } from "@/types/database";

/**
 * Toutes les requêtes vers Claude passent par l'Edge Function
 * `generate-study-material`. La clé Anthropic n'est jamais présente ici.
 * Claude n'est appelé que sur action explicite de l'utilisateur.
 */

export interface GenerateParams {
  courseId: string;
  sectionId?: string | null;
  generationType: GenerationType;
  content?: string;
  force?: boolean;
  options?: {
    count?: number;
    difficulty?: Difficulty;
    question?: string;
    mode?: string;
    exam_id?: string;
    strict_context?: boolean;
  };
}

export interface GenerateResult {
  duplicate: boolean;
  generation_id: string;
  generation_type?: GenerationType;
  items_created: number;
  result_id: string | null;
  message?: string;
  // Explication (non persistée)
  answer?: string;
  grounded?: boolean;
  missing_from_material?: string;
  follow_up_questions?: string[];
  // Résumé
  content?: Record<string, unknown>;
  summary_id?: string;
  // Quiz
  quiz_id?: string;
  title?: string;
}

export async function generateStudyMaterial(params: GenerateParams): Promise<GenerateResult> {
  const { data, error } = await supabase.functions.invoke<GenerateResult>(
    "generate-study-material",
    {
      body: {
        course_id: params.courseId,
        section_id: params.sectionId ?? null,
        generation_type: params.generationType,
        content: params.content,
        force: params.force ?? false,
        options: params.options ?? {},
      },
    },
  );

  if (error) {
    // L'Edge Function renvoie un JSON { error } avec un code HTTP explicite.
    let message = error.message;
    const context = (error as { context?: Response }).context;
    if (context && typeof context.json === "function") {
      try {
        const body = await context.json();
        if (body?.error) message = body.error;
      } catch {
        /* corps non JSON : on garde le message d'origine */
      }
    }
    throw new Error(message);
  }

  if (!data) throw new Error("Réponse vide de la fonction de génération.");
  return data;
}

export async function listGenerations(courseId?: string, limit = 30): Promise<AiGeneration[]> {
  let query = supabase
    .from("ai_generations")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (courseId) query = query.eq("course_id", courseId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as AiGeneration[];
}
