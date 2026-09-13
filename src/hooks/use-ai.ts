import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as ai from "@/services/ai";
import { toMessage } from "@/lib/supabase";

/**
 * Claude n'est appelé que depuis ces mutations, donc uniquement sur action
 * explicite de l'utilisateur (générer / régénérer / expliquer).
 */
export function useGenerate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: ai.GenerateParams) => ai.generateStudyMaterial(params),
    onSuccess: (result, params) => {
      queryClient.invalidateQueries({ queryKey: ["flashcards"] });
      queryClient.invalidateQueries({ queryKey: ["quizzes"] });
      queryClient.invalidateQueries({ queryKey: ["summaries", params.courseId] });
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      queryClient.invalidateQueries({ queryKey: ["ai-generations"] });

      if (result.duplicate) {
        toast.info(result.message ?? "Génération identique déjà existante.");
      }
    },
    onError: (error) => toast.error(toMessage(error)),
  });
}

export function useGenerations(courseId?: string) {
  return useQuery({
    queryKey: ["ai-generations", courseId ?? "all"],
    queryFn: () => ai.listGenerations(courseId),
  });
}
