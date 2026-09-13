import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useUserId } from "@/hooks/use-auth";
import * as materials from "@/services/materials";
import { toMessage } from "@/lib/supabase";

export const materialKeys = {
  list: (courseId: string) => ["materials", courseId] as const,
  summaries: (courseId: string) => ["summaries", courseId] as const,
};

export function useMaterials(courseId: string | undefined) {
  return useQuery({
    queryKey: materialKeys.list(courseId ?? ""),
    queryFn: () => materials.listMaterials(courseId as string),
    enabled: Boolean(courseId),
  });
}

export function useCreateMaterial(courseId: string) {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: materials.MaterialInput) =>
      materials.createMaterial(userId, courseId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: materialKeys.list(courseId) });
      toast.success("Contenu ajouté au cours.");
    },
    onError: (error) => toast.error(toMessage(error)),
  });
}

export function useUpdateMaterial(courseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<materials.MaterialInput> }) =>
      materials.updateMaterial(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: materialKeys.list(courseId) });
      toast.success("Contenu mis à jour.");
    },
    onError: (error) => toast.error(toMessage(error)),
  });
}

export function useDeleteMaterial(courseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => materials.deleteMaterial(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: materialKeys.list(courseId) });
      toast.success("Contenu supprimé.");
    },
    onError: (error) => toast.error(toMessage(error)),
  });
}

export function useSummaries(courseId: string | undefined) {
  return useQuery({
    queryKey: materialKeys.summaries(courseId ?? ""),
    queryFn: () => materials.listSummaries(courseId as string),
    enabled: Boolean(courseId),
  });
}

export function useDeleteSummary(courseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => materials.deleteSummary(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: materialKeys.summaries(courseId) });
      toast.success("Résumé supprimé.");
    },
    onError: (error) => toast.error(toMessage(error)),
  });
}
