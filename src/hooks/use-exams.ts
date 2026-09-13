import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useUserId } from "@/hooks/use-auth";
import * as exams from "@/services/exams";
import { toMessage } from "@/lib/supabase";

export const examKeys = {
  all: ["exams"] as const,
  list: (upcomingOnly: boolean, courseId?: string) =>
    ["exams", "list", upcomingOnly, courseId ?? "all"] as const,
  detail: (id: string) => ["exams", "detail", id] as const,
  readiness: (id: string) => ["exams", "readiness", id] as const,
  sections: (id: string) => ["exams", "sections", id] as const,
};

export function useExams(options: { upcomingOnly?: boolean; courseId?: string } = {}) {
  return useQuery({
    queryKey: examKeys.list(options.upcomingOnly ?? false, options.courseId),
    queryFn: () => exams.listExams(options),
  });
}

export function useExam(examId: string | undefined) {
  return useQuery({
    queryKey: examKeys.detail(examId ?? ""),
    queryFn: () => exams.getExam(examId as string),
    enabled: Boolean(examId),
  });
}

export function useExamReadiness(examId: string | undefined) {
  return useQuery({
    queryKey: examKeys.readiness(examId ?? ""),
    queryFn: () => exams.getExamReadiness(examId as string),
    enabled: Boolean(examId),
  });
}

export function useExamSectionIds(examId: string | undefined) {
  return useQuery({
    queryKey: examKeys.sections(examId ?? ""),
    queryFn: () => exams.getExamSectionIds(examId as string),
    enabled: Boolean(examId),
  });
}

export function useCreateExam() {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ input, sectionIds }: { input: exams.ExamInput; sectionIds?: string[] }) =>
      exams.createExam(userId, input, sectionIds ?? []),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: examKeys.all });
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Examen enregistré.");
    },
    onError: (error) => toast.error(toMessage(error)),
  });
}

export function useUpdateExam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      examId,
      input,
      sectionIds,
    }: {
      examId: string;
      input: Partial<exams.ExamInput>;
      sectionIds?: string[];
    }) => exams.updateExam(examId, input, sectionIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: examKeys.all });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Examen mis à jour.");
    },
    onError: (error) => toast.error(toMessage(error)),
  });
}

export function useDeleteExam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (examId: string) => exams.deleteExam(examId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: examKeys.all });
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Examen supprimé.");
    },
    onError: (error) => toast.error(toMessage(error)),
  });
}
