/**
 * Edge Function : generate-study-material
 *
 * Unique point d'entrée vers Claude. La clé ANTHROPIC_API_KEY est lue depuis
 * les secrets Supabase et ne quitte jamais le serveur.
 *
 * Contrat :
 *   POST { course_id, section_id?, generation_type, content?, options? }
 *
 * generation_type ∈ summary | flashcards | quiz | key_concepts | study_plan | explanation
 *
 * L'appel est authentifié : le client Supabase est créé avec le JWT de
 * l'utilisateur, donc la RLS s'applique à toutes les lectures et écritures.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.47.10";
import Anthropic from "npm:@anthropic-ai/sdk@0.125.0";
import { corsHeaders, errorResponse, jsonResponse } from "../_shared/cors.ts";
import { buildUserPrompt, SYSTEM_PROMPT } from "./prompts.ts";
import {
  GENERATION_TYPES,
  type GenerationType,
  TOOL_SCHEMAS,
  ValidationError,
  validateExplanation,
  validateFlashcards,
  validateKeyConcepts,
  validateQuiz,
  validateStudyPlan,
  validateSummary,
} from "./schemas.ts";

const MODEL = "claude-opus-5";
const MAX_MATERIAL_CHARS = 120_000;
const MAX_ITEMS = 50;
const DEDUPE_WINDOW_HOURS = 24;

async function sha256(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return errorResponse("Méthode non autorisée.", 405);
  }

  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!anthropicKey) {
    return errorResponse(
      "ANTHROPIC_API_KEY n'est pas configurée dans les secrets Supabase.",
      500,
    );
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return errorResponse("Authentification requise.", 401);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
  );

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData?.user) {
    return errorResponse("Session invalide.", 401);
  }
  const user = userData.user;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return errorResponse("Corps de requête JSON invalide.");
  }

  const generationType = String(body.generation_type ?? "") as GenerationType;
  if (!GENERATION_TYPES.includes(generationType)) {
    return errorResponse(
      `generation_type invalide. Valeurs acceptées : ${GENERATION_TYPES.join(", ")}.`,
    );
  }

  const courseId = body.course_id ? String(body.course_id) : null;
  const sectionId = body.section_id ? String(body.section_id) : null;
  if (!courseId) return errorResponse("course_id est requis.");

  const options = (body.options ?? {}) as Record<string, unknown>;
  const force = body.force === true;

  // --- Le cours doit appartenir à l'utilisateur (vérifié par la RLS) -------
  const { data: course, error: courseError } = await supabase
    .from("courses")
    .select("id, name")
    .eq("id", courseId)
    .maybeSingle();

  if (courseError) return errorResponse(courseError.message, 500);
  if (!course) return errorResponse("Cours introuvable ou non autorisé.", 403);

  let sectionTitle: string | null = null;
  if (sectionId) {
    const { data: section } = await supabase
      .from("course_sections")
      .select("id, title, course_id")
      .eq("id", sectionId)
      .maybeSingle();
    if (!section || section.course_id !== courseId) {
      return errorResponse("Chapitre introuvable ou non autorisé.", 403);
    }
    sectionTitle = section.title;
  }

  // --- Construction du contexte à partir de la base -----------------------
  let materialQuery = supabase
    .from("study_materials")
    .select("title, raw_content, processed_content, type")
    .eq("course_id", courseId)
    .order("created_at", { ascending: true });

  if (sectionId) materialQuery = materialQuery.eq("section_id", sectionId);

  const { data: materials, error: materialsError } = await materialQuery;
  if (materialsError) return errorResponse(materialsError.message, 500);

  const pieces: string[] = [];
  for (const m of materials ?? []) {
    const text = (m.processed_content ?? m.raw_content ?? "").trim();
    if (text) pieces.push(`## ${m.title}\n${text}`);
  }

  const extraContent = typeof body.content === "string" ? body.content.trim() : "";
  if (extraContent) pieces.push(`## Contenu fourni pour cette génération\n${extraContent}`);

  const material = pieces.join("\n\n").slice(0, MAX_MATERIAL_CHARS);
  if (material.length < 40 && generationType !== "explanation") {
    return errorResponse(
      "Le matériel de cours est vide ou trop court. Ajoute du contenu à ce chapitre avant de lancer une génération.",
      422,
    );
  }

  // --- Options ------------------------------------------------------------
  const count = clampInt(options.count, 3, MAX_ITEMS, generationType === "quiz" ? 10 : 15);
  const difficulty = ["easy", "medium", "hard"].includes(String(options.difficulty))
    ? (String(options.difficulty) as "easy" | "medium" | "hard")
    : "medium";
  const question = typeof options.question === "string" ? options.question.trim().slice(0, 2000) : "";
  const explainMode = typeof options.mode === "string" ? options.mode : "free";
  const strictContext = options.strict_context !== false;

  if (generationType === "explanation" && !question) {
    return errorResponse("Une question est requise pour une explication.");
  }

  let daysUntilExam: number | null = null;
  if (options.exam_id) {
    const { data: exam } = await supabase
      .from("exams")
      .select("exam_date")
      .eq("id", String(options.exam_id))
      .maybeSingle();
    if (exam?.exam_date) {
      daysUntilExam = Math.ceil(
        (new Date(exam.exam_date).getTime() - Date.now()) / 86_400_000,
      );
    }
  }

  // --- Déduplication : évite de repayer une génération identique ----------
  const inputHash = await sha256(
    JSON.stringify({ generationType, courseId, sectionId, count, difficulty, question, explainMode, material }),
  );

  if (!force && generationType !== "explanation") {
    const since = new Date(Date.now() - DEDUPE_WINDOW_HOURS * 3_600_000).toISOString();
    const { data: previous } = await supabase
      .from("ai_generations")
      .select("id, result_id, items_created, created_at")
      .eq("generation_type", generationType)
      .eq("input_hash", inputHash)
      .eq("status", "success")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (previous) {
      return jsonResponse({
        duplicate: true,
        generation_id: previous.id,
        result_id: previous.result_id,
        items_created: previous.items_created,
        message:
          "Une génération identique existe déjà. Utilise « Régénérer » pour en produire une nouvelle.",
      });
    }
  }

  const { data: generation, error: generationError } = await supabase
    .from("ai_generations")
    .insert({
      user_id: user.id,
      course_id: courseId,
      section_id: sectionId,
      generation_type: generationType,
      input_hash: inputHash,
      model: MODEL,
      status: "pending",
    })
    .select("id")
    .single();

  if (generationError) return errorResponse(generationError.message, 500);

  const failGeneration = async (message: string, status = 500) => {
    await supabase
      .from("ai_generations")
      .update({ status: "error", error_message: message.slice(0, 500), completed_at: new Date().toISOString() })
      .eq("id", generation.id);
    return errorResponse(message, status, { generation_id: generation.id });
  };

  // --- Appel Claude -------------------------------------------------------
  const tool = TOOL_SCHEMAS[generationType];
  let toolInput: unknown;
  let usage = { input_tokens: 0, output_tokens: 0 };

  try {
    const anthropic = new Anthropic({ apiKey: anthropicKey });

    const stream = anthropic.messages.stream({
      model: MODEL,
      max_tokens: 32_000,
      system: SYSTEM_PROMPT,
      tools: [{ ...tool, strict: true }],
      tool_choice: { type: "auto" },
      messages: [
        {
          role: "user",
          content: buildUserPrompt(generationType, {
            courseName: course.name,
            sectionTitle,
            material,
            count,
            difficulty,
            question,
            explainMode,
            daysUntilExam,
            strictContext,
          }),
        },
      ],
    });

    const message = await stream.finalMessage();
    usage = {
      input_tokens: message.usage?.input_tokens ?? 0,
      output_tokens: message.usage?.output_tokens ?? 0,
    };

    if (message.stop_reason === "refusal") {
      return await failGeneration(
        "Claude a refusé de traiter cette demande. Reformule ou vérifie le contenu du cours.",
        422,
      );
    }

    const toolUse = message.content.find(
      (block) => block.type === "tool_use" && block.name === tool.name,
    );
    if (!toolUse || toolUse.type !== "tool_use") {
      return await failGeneration(
        "Claude n'a pas renvoyé de résultat structuré. Réessaie dans un instant.",
        502,
      );
    }
    toolInput = toolUse.input;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur inconnue";
    return await failGeneration(`Appel à Claude impossible : ${message}`, 502);
  }

  // --- Validation + persistance ------------------------------------------
  try {
    let resultId: string | null = null;
    let itemsCreated = 0;
    let payload: Record<string, unknown> = {};

    switch (generationType) {
      case "flashcards": {
        const cards = validateFlashcards(toolInput, count);
        const { data: inserted, error } = await supabase
          .from("flashcards")
          .insert(
            cards.map((card) => ({
              user_id: user.id,
              course_id: courseId,
              section_id: sectionId,
              question: card.question,
              answer: card.answer,
              explanation: card.explanation || null,
              difficulty: card.difficulty,
              topic: card.topic || null,
              created_by: "claude" as const,
            })),
          )
          .select("id");
        if (error) throw new Error(error.message);
        itemsCreated = inserted?.length ?? 0;
        payload = { flashcards: cards };
        break;
      }

      case "quiz": {
        const quiz = validateQuiz(toolInput, count);
        const { data: createdQuiz, error: quizError } = await supabase
          .from("quizzes")
          .insert({
            user_id: user.id,
            course_id: courseId,
            section_id: sectionId,
            title: quiz.title,
            difficulty,
            created_by: "claude" as const,
          })
          .select("id")
          .single();
        if (quizError) throw new Error(quizError.message);

        const { error: questionsError } = await supabase.from("quiz_questions").insert(
          quiz.questions.map((q, index) => ({
            quiz_id: createdQuiz.id,
            position: index,
            question: q.question,
            question_type: q.question_type,
            choices: q.choices,
            correct_answer: q.correct_answer,
            explanation: q.explanation || null,
            topic: q.topic || null,
            difficulty: q.difficulty,
          })),
        );
        if (questionsError) {
          await supabase.from("quizzes").delete().eq("id", createdQuiz.id);
          throw new Error(questionsError.message);
        }

        resultId = createdQuiz.id;
        itemsCreated = quiz.questions.length;
        payload = { quiz_id: createdQuiz.id, title: quiz.title, questions: quiz.questions };
        break;
      }

      case "summary":
      case "key_concepts":
      case "study_plan": {
        const content = generationType === "summary"
          ? validateSummary(toolInput)
          : generationType === "key_concepts"
          ? validateKeyConcepts(toolInput)
          : validateStudyPlan(toolInput);

        const { data: summary, error } = await supabase
          .from("study_summaries")
          .insert({
            user_id: user.id,
            course_id: courseId,
            section_id: sectionId,
            title: String(content.title ?? "Résumé"),
            content: { ...content, kind: generationType },
            generated_by: "claude" as const,
          })
          .select("id")
          .single();
        if (error) throw new Error(error.message);

        resultId = summary.id;
        itemsCreated = 1;
        payload = { summary_id: summary.id, content };
        break;
      }

      case "explanation": {
        // Rien n'est persisté : une explication est une réponse ponctuelle.
        payload = validateExplanation(toolInput);
        itemsCreated = 1;
        break;
      }
    }

    await supabase
      .from("ai_generations")
      .update({
        status: "success",
        result_id: resultId,
        items_created: itemsCreated,
        input_tokens: usage.input_tokens,
        output_tokens: usage.output_tokens,
        completed_at: new Date().toISOString(),
      })
      .eq("id", generation.id);

    return jsonResponse({
      duplicate: false,
      generation_id: generation.id,
      generation_type: generationType,
      items_created: itemsCreated,
      result_id: resultId,
      ...payload,
    });
  } catch (error) {
    const message = error instanceof ValidationError
      ? `Résultat de Claude invalide : ${error.message}`
      : error instanceof Error
      ? error.message
      : "Erreur inconnue";
    return await failGeneration(message, error instanceof ValidationError ? 422 : 500);
  }
});
