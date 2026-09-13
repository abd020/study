import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth, useUserId } from "@/hooks/use-auth";
import * as account from "@/services/account";
import { toMessage } from "@/lib/supabase";
import type { UserSettings } from "@/types/database";

export const accountKeys = {
  settings: (userId: string) => ["settings", userId] as const,
  notifications: ["notifications"] as const,
};

export function useSettings() {
  const userId = useUserId();
  return useQuery({
    queryKey: accountKeys.settings(userId),
    queryFn: () => account.getSettings(userId),
    staleTime: 5 * 60_000,
  });
}

export function useUpdateSettings() {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<Omit<UserSettings, "user_id" | "created_at" | "updated_at">>) =>
      account.updateSettings(userId, input),
    onSuccess: (settings) => {
      queryClient.setQueryData(accountKeys.settings(userId), settings);
      toast.success("Préférences enregistrées.");
    },
    onError: (error) => toast.error(toMessage(error)),
  });
}

export function useUpdateProfile() {
  const userId = useUserId();
  const { refreshProfile } = useAuth();
  return useMutation({
    mutationFn: (input: { first_name?: string | null; last_name?: string | null }) =>
      account.updateProfile(userId, input),
    onSuccess: async () => {
      await refreshProfile();
      toast.success("Profil mis à jour.");
    },
    onError: (error) => toast.error(toMessage(error)),
  });
}

export function useNotifications() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: accountKeys.notifications,
    queryFn: () => account.listNotifications(),
  });

  // Les rappels sont recalculés en base (aucun appel IA) au montage.
  useEffect(() => {
    void account
      .refreshNotifications()
      .then((created) => {
        if (created > 0) queryClient.invalidateQueries({ queryKey: accountKeys.notifications });
      })
      .catch(() => {
        /* silencieux : les notifications ne doivent jamais bloquer l'UI */
      });
  }, [queryClient]);

  return query;
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => account.markNotificationRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: accountKeys.notifications }),
  });
}

export function useMarkAllNotificationsRead() {
  const userId = useUserId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => account.markAllNotificationsRead(userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: accountKeys.notifications }),
  });
}

export function useSearch(query: string) {
  return useQuery({
    queryKey: ["search", query],
    queryFn: () => account.search(query),
    enabled: query.trim().length >= 2,
    staleTime: 10_000,
  });
}
