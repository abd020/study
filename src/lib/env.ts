/**
 * Variables d'environnement du front.
 *
 * Vite les remplace littéralement au moment du build : elles doivent donc être
 * présentes sur la machine qui compile (Vercel, CI), pas seulement en local.
 * Elles sont lues ici, et non dans `@/lib/supabase`, pour que l'application
 * puisse afficher un écran d'explication au lieu d'échouer dès l'import.
 *
 * L'accès doit rester littéral (`import.meta.env.VITE_…`) pour que la
 * substitution de Vite opère : une lecture par clé dynamique ne serait pas
 * remplacée à la compilation.
 */
const FRONT_ENV = {
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
} as const;

export type FrontEnvVar = keyof typeof FRONT_ENV;

/** Liste les variables requises absentes du build (vide si tout est présent). */
export function missingEnvVars(): FrontEnvVar[] {
  return (Object.keys(FRONT_ENV) as FrontEnvVar[]).filter((name) => !FRONT_ENV[name]);
}
