import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Indique si les variables d'environnement Supabase sont présentes.
 *
 * Elles sont injectées **au moment du build** par Vite : sur un hébergeur
 * comme Vercel ou Netlify, elles doivent être déclarées dans les réglages du
 * projet avant le déploiement, un fichier .env local ne suffit pas (il n'est
 * pas versionné).
 *
 * On ne lève pas d'exception ici : un `throw` au chargement du module
 * produirait une page blanche sans explication. L'application affiche à la
 * place un écran de configuration (voir ConfigurationRequired).
 */
export const isSupabaseConfigured = Boolean(url && anonKey);

export const missingSupabaseEnv = [
  url ? null : "VITE_SUPABASE_URL",
  anonKey ? null : "VITE_SUPABASE_ANON_KEY",
].filter((name): name is string => name !== null);

/**
 * Client Supabase partagé. La clé anonyme est publique par conception :
 * toute la sécurité repose sur les politiques RLS définies côté PostgreSQL.
 * Aucune clé Anthropic n'existe côté navigateur.
 */
export const supabase = createClient(
  url || "https://non-configure.supabase.co",
  anonKey || "non-configure",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
    },
  },
);

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
    "Failed to fetch":
      "Impossible de joindre Supabase. Vérifie l'URL du projet et ta connexion.",
  };

  return map[message] ?? message;
}
