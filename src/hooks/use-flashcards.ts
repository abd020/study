import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useUserId } from "@/hooks/use-auth";
import * as flashcards from "@/services/flashcards";
import { toMessage } from "@/lib/supabase";
import type { ReviewGrade, SchedulingState } from "@/lib/sm2";

export const flashcardKeys = {
  all: ["flashcards"] as const,
  list: (courseId: string, sectionId?: string | null) =>
    ["flashcards", courseId, sectionId ?? "all"] as const,
  due: (courseId?: string | null, sectionIds?: string[] | null) =>
    ["flashcards", "due", courseId ?? "all", (sectionIds ?? []).join(",")] as const,
  examSession: (examId: string) => ["flashcards", "exam-session", examId] as const,
};

export function useFlashcards(courseId: string | undefined, sectionId?: string | null) {
  return useQuery({
    queryKey: flashcardKeys.list(courseId ?? "", sectionId),
    queryFn: () => flashcards.listFlashcards(courseId as string, sectionId),
    enabled: Boolean(courseId),
  });
}

export function useDueCards(params: {
  courseId?: string | null;
  sectionIds?: string[] | null;
  limit?: number;
  includeNew?: boolean;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: flashcardKeys.due(params.courseId, params.sectionIds),
    queryFn: () =>
      flashcards.getDueCards({
        courseId: params.courseId,
        sectionIds: params.sectionIds,
        limit: params.limit,
        includeNew: params.includeNew,
      }),
    enabled: params.enabled ?? true,
  });
}

export function useExamSessionCards(examId: string | undefined, limit = 30) {
  return useQuery({
    queryKey: flashcardKeys.examSession(examId ?? ""),
    queryFn: () => flashcards.getExamSessionCards(examId as string, limit),
    enabled: Boolean(examId),
  });
}

export function useCreateFlashcard(courseId: string) {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: flashcards.FlashcardInput) =>
      flashcards.createFlashcard(userId, courseId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: flashcardKeys.all });
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      toast.success("Flashcard créée.");
    },
    onError: (error) => toast.error(toMessage(error)),
  });
}

export function useUpdateFlashcard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<flashcards.FlashcardInput> }) =>
      flashcards.updateFlashcard(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: flashcardKeys.all });
      toast.success("Flashcard mise à jour.");
    },
    onError: (error) => toast.error(toMessage(error)),
  });
}

export function useDeleteFlashcard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => flashcards.deleteFlashcard(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: flashcardKeys.all });
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      toast.success("Flashcard supprimée.");
    },
    onError: (error) => toast.error(toMessage(error)),
  });
}

/** Enregistre une révision SM-2. Pas de toast : l'action est très fréquente. */
export function useRecordReview() {
  const userId = useUserId();
  return useMutation({
    mutationFn: (params: { cardId: string; grade: ReviewGrade; current?: SchedulingState | null }) =>
      flashcards.recordReview({ userId, ...params }),
    onError: (error) => toast.error(toMessage(error)),
  });
}
