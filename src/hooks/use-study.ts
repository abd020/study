import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useUserId } from "@/hooks/use-auth";
import * as study from "@/services/study";
import { toMessage } from "@/lib/supabase";
import type { SessionType } from "@/types/database";

export const studyKeys = {
  dashboard: ["dashboard"] as const,
  progress: (days: number) => ["progress", days] as const,
  weakTopics: (courseId?: string | null) => ["weak-topics", courseId ?? "all"] as const,
  sessions: ["study-sessions"] as const,
};

export function useDashboard() {
  return useQuery({ queryKey: studyKeys.dashboard, queryFn: study.getDashboardSummary });
}

export function useProgressOverview(days = 30) {
  return useQuery({
    queryKey: studyKeys.progress(days),
    queryFn: () => study.getProgressOverview(days),
  });
}

export function useWeakTopics(courseId?: string | null, limit = 12) {
  return useQuery({
    queryKey: studyKeys.weakTopics(courseId),
    queryFn: () => study.getWeakTopics(courseId, limit),
  });
}

export function useRecentSessions(limit = 15) {
  return useQuery({
    queryKey: [...studyKeys.sessions, limit],
    queryFn: () => study.listRecentSessions(limit),
  });
}

export function useStartSession() {
  const userId = useUserId();
  return useMutation({
    mutationFn: (params: { sessionType: SessionType; courseId?: string | null; examId?: string | null }) =>
      study.startSession({ userId, ...params }),
    onError: (error) => toast.error(toMessage(error)),
  });
}

export function useEndSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: study.endSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: studyKeys.dashboard });
      queryClient.invalidateQueries({ queryKey: ["progress"] });
      queryClient.invalidateQueries({ queryKey: ["weak-topics"] });
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      queryClient.invalidateQueries({ queryKey: studyKeys.sessions });
    },
    onError: (error) => toast.error(toMessage(error)),
  });
}
