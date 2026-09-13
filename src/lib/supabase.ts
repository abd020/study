import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Configuration Supabase manquante. Copie .env.example vers .env et renseigne " +
      "VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY.",
  );
}

/**
 * Client Supabase partagé. La clé anonyme est publique par conception :
 * toute la sécurité repose sur les politiques RLS définies côté PostgreSQL.
 * Aucune clé Anthropic n'existe côté navigateur.
 */
export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: "pkce",
  },
});

/** Transforme une erreur Supabase/PostgREST en message lisible en français. */
export function toMessage(error: unknown): string {
  if (!error) return "Une erreur inattendue est survenue.";
  const message = typeof error === "string"
    ? error
    : (error as { message?: string }).message ?? "Une erreur inattendue est survenue.";

  const map: Record<string, string> = {
    "Invalid login credentials": "Email ou mot de passe incorrect.",
    "User already registered": "Un compte existe déjà avec cet email.",
    "Email not confirmed": "Confirme ton adresse email avant de te connecter.",
    "Password should be at least 6 characters":
      "Le mot de passe doit contenir au moins 6 caractères.",
    "New password should be different from the old password.":
      "Le nouveau mot de passe doit être différent de l'ancien.",
  };

  return map[message] ?? message;
}
