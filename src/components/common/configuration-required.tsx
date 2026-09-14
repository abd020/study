import { AlertTriangle } from "lucide-react";
import { missingSupabaseEnv } from "@/lib/supabase";

/**
 * Écran affiché lorsque les variables Supabase manquent dans le build.
 * C'est le cas typique d'un premier déploiement sur Vercel ou Netlify : le
 * fichier .env local n'est pas versionné, les variables doivent être
 * déclarées dans les réglages de l'hébergeur puis le projet redéployé.
 */
export function ConfigurationRequired() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-5 py-12">
      <div className="w-full max-w-lg">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-warning/15 text-warning">
          <AlertTriangle className="h-5 w-5" />
        </div>

        <h1 className="mt-5 text-xl font-semibold tracking-tight">
          Configuration Supabase manquante
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          L'application a été compilée sans ses variables d'environnement. Vite les
          remplace <strong>au moment du build</strong> : un fichier <code>.env</code> local
          ne suffit pas, car il n'est pas versionné.
        </p>

        <div className="mt-6 rounded-lg border border-border bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Variables absentes
          </p>
          <ul className="mt-2 space-y-1">
            {missingSupabaseEnv.map((name) => (
              <li key={name} className="font-mono text-sm text-destructive">
                {name}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6 space-y-4 text-sm leading-relaxed">
          <div>
            <p className="font-medium">Sur Vercel</p>
            <p className="mt-1 text-muted-foreground">
              Settings → Environment Variables → ajouter les deux variables pour
              Production, Preview et Development, puis <strong>redéployer</strong> :
              les variables ne sont prises en compte qu'à la compilation suivante.
            </p>
          </div>
          <div>
            <p className="font-medium">En local</p>
            <p className="mt-1 text-muted-foreground">
              Copier <code>.env.example</code> vers <code>.env</code> et renseigner
              les deux valeurs, puis relancer <code>npm run dev</code>.
            </p>
          </div>
          <div>
            <p className="font-medium">Où trouver ces valeurs</p>
            <p className="mt-1 text-muted-foreground">
              Tableau de bord Supabase → Project Settings → API : <em>Project URL</em> et
              la clé <em>anon public</em>. Cette clé est publique par conception ; la
              sécurité repose sur les politiques RLS.
            </p>
          </div>
        </div>

        <p className="mt-6 text-xs text-muted-foreground">
          La clé Anthropic ne doit jamais figurer ici : elle se déclare côté serveur,
          avec <code>supabase secrets set ANTHROPIC_API_KEY=…</code>.
        </p>
      </div>
    </div>
  );
}
