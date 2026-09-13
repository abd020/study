import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useUserId } from "@/hooks/use-auth";
import * as courses from "@/services/courses";
import * as sections from "@/services/sections";
import { toMessage } from "@/lib/supabase";

export const courseKeys = {
  all: ["courses"] as const,
  list: (archived: boolean) => ["courses", "list", archived] as const,
  detail: (id: string) => ["courses", "detail", id] as const,
  sections: (courseId: string) => ["courses", courseId, "sections"] as const,
};

export function useCourses(includeArchived = false) {
  return useQuery({
    queryKey: courseKeys.list(includeArchived),
    queryFn: () => courses.listCourses(includeArchived),
  });
}

export function useCourse(courseId: string | undefined) {
  return useQuery({
    queryKey: courseKeys.detail(courseId ?? ""),
    queryFn: () => courses.getCourse(courseId as string),
    enabled: Boolean(courseId),
  });
}

export function useCreateCourse() {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: courses.CourseInput) => courses.createCourse(userId, input),
    onSuccess: (course) => {
      queryClient.invalidateQueries({ queryKey: courseKeys.all });
      toast.success(`Cours « ${course.name} » créé.`);
    },
    onError: (error) => toast.error(toMessage(error)),
  });
}

export function useUpdateCourse(courseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<courses.CourseInput>) => courses.updateCourse(courseId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: courseKeys.all });
      toast.success("Cours mis à jour.");
    },
    onError: (error) => toast.error(toMessage(error)),
  });
}

export function useDeleteCourse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (courseId: string) => courses.deleteCourse(courseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: courseKeys.all });
      toast.success("Cours supprimé.");
    },
    onError: (error) => toast.error(toMessage(error)),
  });
}

export function useSections(courseId: string | undefined) {
  return useQuery({
    queryKey: courseKeys.sections(courseId ?? ""),
    queryFn: () => sections.listSections(courseId as string),
    enabled: Boolean(courseId),
  });
}

export function useCreateSection(courseId: string) {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: sections.SectionInput) => sections.createSection(userId, courseId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: courseKeys.sections(courseId) });
      queryClient.invalidateQueries({ queryKey: courseKeys.detail(courseId) });
      toast.success("Chapitre ajouté.");
    },
    onError: (error) => toast.error(toMessage(error)),
  });
}

export function useUpdateSection(courseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<sections.SectionInput> }) =>
      sections.updateSection(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: courseKeys.sections(courseId) });
      toast.success("Chapitre mis à jour.");
    },
    onError: (error) => toast.error(toMessage(error)),
  });
}

/** Déplace un chapitre d'une position vers le haut ou vers le bas. */
export function useReorderSections(courseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ordered: { id: string; position: number }[]) => sections.reorderSections(ordered),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: courseKeys.sections(courseId) }),
    onError: (error) => toast.error(toMessage(error)),
  });
}

export function useDeleteSection(courseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sectionId: string) => sections.deleteSection(sectionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: courseKeys.sections(courseId) });
      queryClient.invalidateQueries({ queryKey: courseKeys.detail(courseId) });
      toast.success("Chapitre supprimé.");
    },
    onError: (error) => toast.error(toMessage(error)),
  });
}
