import { GraduationCap } from "lucide-react";

export function AuthLayout({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      {/* Colonne de présentation — masquée sur mobile */}
      <div className="hidden w-[44%] flex-col justify-between bg-primary p-10 text-primary-foreground lg:flex">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15">
            <GraduationCap className="h-4.5 w-4.5" />
          </span>
          <span className="text-base font-semibold tracking-tight">Revia</span>
        </div>

        <div className="max-w-md">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight text-balance">
            Tous tes cours, une seule plateforme de révision.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-primary-foreground/80">
            Centralise tes chapitres, génère flashcards, quiz et résumés à partir de ton propre
            matériel, et laisse la répétition espacée décider de ce que tu dois revoir aujourd'hui.
          </p>
          <ul className="mt-8 space-y-2.5 text-sm text-primary-foreground/80">
            <li>· Répétition espacée inspirée de SM-2</li>
            <li>· Détection automatique des points faibles</li>
            <li>· Révision ciblée avant chaque examen</li>
          </ul>
        </div>

        <p className="text-xs text-primary-foreground/60">
          Tes données restent privées : chaque compte ne voit que ses propres cours.
        </p>
      </div>

      {/* Formulaire */}
      <div className="flex flex-1 items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <GraduationCap className="h-4.5 w-4.5" />
            </span>
            <span className="text-base font-semibold tracking-tight">Revia</span>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>

          <div className="mt-7">{children}</div>

          {footer ? <div className="mt-6 text-sm text-muted-foreground">{footer}</div> : null}
        </div>
      </div>
    </div>
  );
}
