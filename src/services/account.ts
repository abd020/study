import { supabase } from "@/lib/supabase";
import type { AppNotification, AppRole, Profile, SearchResult, UserSettings } from "@/types/database";

// --- Profil ---------------------------------------------------------------

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw error;
  return (data as Profile) ?? null;
}

export async function updateProfile(
  userId: string,
  input: Partial<Pick<Profile, "first_name" | "last_name" | "avatar_url">>,
): Promise<Profile> {
  const { data, error } = await supabase
    .from("profiles")
    .update(input)
    .eq("id", userId)
    .select("*")
    .single();
  if (error) throw error;
  return data as Profile;
}

export async function getRoles(userId: string): Promise<AppRole[]> {
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw error;
  return (data ?? []).map((row) => (row as { role: AppRole }).role);
}

// --- Préférences ----------------------------------------------------------

export async function getSettings(userId: string): Promise<UserSettings> {
  const { data, error } = await supabase
    .from("user_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;

  if (!data) {
    const { data: created, error: insertError } = await supabase
      .from("user_settings")
      .insert({ user_id: userId })
      .select("*")
      .single();
    if (insertError) throw insertError;
    return created as UserSettings;
  }
  return data as UserSettings;
}

export async function updateSettings(
  userId: string,
  input: Partial<Omit<UserSettings, "user_id" | "created_at" | "updated_at">>,
): Promise<UserSettings> {
  const { data, error } = await supabase
    .from("user_settings")
    .update(input)
    .eq("user_id", userId)
    .select("*")
    .single();
  if (error) throw error;
  return data as UserSettings;
}

// --- Notifications --------------------------------------------------------

export async function listNotifications(limit = 30): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as AppNotification[];
}

/** Génère les rappels (examens, cartes dues) côté base, sans IA. */
export async function refreshNotifications(): Promise<number> {
  const { data, error } = await supabase.rpc("refresh_notifications");
  if (error) throw error;
  return (data as number) ?? 0;
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase.from("notifications").update({ read: true }).eq("id", id);
  if (error) throw error;
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", userId)
    .eq("read", false);
  if (error) throw error;
}

// --- Recherche globale ----------------------------------------------------

export async function search(query: string, limit = 30): Promise<SearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  const { data, error } = await supabase.rpc("global_search", { p_query: trimmed, p_limit: limit });
  if (error) throw error;
  return (data ?? []) as SearchResult[];
}

// --- Données de démonstration --------------------------------------------

export async function seedDemoData(): Promise<{ created: boolean; reason?: string }> {
  const { data, error } = await supabase.rpc("seed_demo_data");
  if (error) throw error;
  return data as { created: boolean; reason?: string };
}

export async function removeDemoData(): Promise<{ deleted: number }> {
  const { data, error } = await supabase.rpc("remove_demo_data");
  if (error) throw error;
  return data as { deleted: number };
}
