import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as quizzes from "@/services/quizzes";
import { toMessage } from "@/lib/supabase";

export const quizKeys = {
  all: ["quizzes"] as const,
  list: (courseId?: string) => ["quizzes", "list", courseId ?? "all"] as const,
  detail: (id: string) => ["quizzes", "detail", id] as const,
  attempts: ["quizzes", "attempts"] as const,
};

export function useQuizzes(courseId?: string) {
  return useQuery({
    queryKey: quizKeys.list(courseId),
    queryFn: () => quizzes.listQuizzes(courseId),
  });
}

export function useQuiz(quizId: string | undefined) {
  return useQuery({
    queryKey: quizKeys.detail(quizId ?? ""),
    queryFn: () => quizzes.getQuiz(quizId as string),
    enabled: Boolean(quizId),
  });
}

export function useQuizAttempts(limit = 25) {
  return useQuery({
    queryKey: [...quizKeys.attempts, limit],
    queryFn: () => quizzes.listAttempts(limit),
  });
}

export function useDeleteQuiz() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (quizId: string) => quizzes.deleteQuiz(quizId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: quizKeys.all });
      toast.success("Quiz supprimé.");
    },
    onError: (error) => toast.error(toMessage(error)),
  });
}
