import { AlertTriangle, KeyRound, Laptop, Cloud } from "lucide-react";
import type { FrontEnvVar } from "@/lib/env";

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">
      {children}
    </code>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Cloud;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-1.5">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        {title}
      </h2>
      <div className="text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

/**
 * Écran affiché quand le build ne contient pas les variables Supabase.
 * Sans lui, `@/lib/supabase` lève à l'import et la page reste blanche :
 * un symptôme illisible pour un déploiement mal configuré.
 */
export function ConfigError({ missing }: { missing: FrontEnvVar[] }) {
  return (
    <main className="flex min-h-full items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-xl space-y-6 rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <header className="space-y-2">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" aria-hidden />
            </span>
            <h1 className="text-lg font-semibold text-card-foreground">
              Configuration Supabase manquante
            </h1>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            L'application a été compilée sans ses variables d'environnement. Vite les remplace au
            moment du build : un fichier <Code>.env</Code> local ne suffit pas, car il n'est pas
            versionné.
          </p>
        </header>

        <div className="rounded-lg border border-border bg-muted/40 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Variables absentes
          </h2>
          <ul className="mt-2 space-y-1">
            {missing.map((name) => (
              <li key={name} className="font-mono text-sm text-destructive">
                {name}
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-5">
          <Section icon={Cloud} title="Sur Vercel">
            Settings → Environment Variables → ajouter les deux variables pour Production, Preview
            et Development, puis redéployer : les variables ne sont prises en compte qu'à la
            compilation suivante.
          </Section>

          <Section icon={Laptop} title="En local">
            Copier <Code>.env.example</Code> vers <Code>.env</Code> et renseigner les deux valeurs,
            puis relancer <Code>npm run dev</Code>.
          </Section>

          <Section icon={KeyRound} title="Où trouver ces valeurs">
            Tableau de bord Supabase → Project Settings → API : <em>Project URL</em> et la clé{" "}
            <em>anon public</em>. Cette clé est publique par conception ; la sécurité repose sur les
            politiques RLS.
          </Section>
        </div>

        <p className="border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
          La clé Anthropic ne doit jamais figurer ici : elle se déclare côté serveur, avec{" "}
          <Code>supabase secrets set ANTHROPIC_API_KEY=…</Code>
        </p>
      </div>
    </main>
  );
}
