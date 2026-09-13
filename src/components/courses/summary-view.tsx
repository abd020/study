import { AlertTriangle, BookMarked, GraduationCap, ListTree, Sigma, Target } from "lucide-react";
import type { SummaryContent } from "@/types/database";

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Target;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h4 className="flex items-center gap-2 text-sm font-semibold">
        <Icon className="h-4 w-4 text-muted-foreground" /> {title}
      </h4>
      {children}
    </section>
  );
}

export function SummaryView({ content }: { content: SummaryContent }) {
  return (
    <div className="space-y-6">
      {content.overview ? (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
          {content.overview}
        </p>
      ) : null}

      {content.key_concepts?.length ? (
        <Section icon={Target} title="Concepts importants">
          <ul className="space-y-2">
            {content.key_concepts.map((item) => (
              <li key={item.name} className="rounded-lg border bg-card p-3">
                <p className="text-sm font-medium">{item.name}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{item.description}</p>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {content.concepts?.length ? (
        <Section icon={ListTree} title="Notions clés">
          <ul className="space-y-2">
            {content.concepts.map((item) => (
              <li key={item.name} className="rounded-lg border bg-card p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{item.name}</p>
                  <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    {item.importance === "high" ? "Essentiel" : item.importance === "medium" ? "Important" : "Secondaire"}
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">{item.description}</p>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {content.definitions?.length ? (
        <Section icon={BookMarked} title="Définitions">
          <dl className="space-y-2">
            {content.definitions.map((item) => (
              <div key={item.term} className="rounded-lg bg-muted/60 p-3">
                <dt className="text-sm font-medium">{item.term}</dt>
                <dd className="mt-0.5 text-sm text-muted-foreground">{item.definition}</dd>
              </div>
            ))}
          </dl>
        </Section>
      ) : null}

      {content.formulas?.length ? (
        <Section icon={Sigma} title="Formules">
          <ul className="space-y-2">
            {content.formulas.map((item) => (
              <li key={item.expression} className="rounded-lg border bg-card p-3">
                <code className="text-sm font-medium">{item.expression}</code>
                <p className="mt-1 text-sm text-muted-foreground">{item.meaning}</p>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {content.memorize?.length ? (
        <Section icon={Target} title="À mémoriser">
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {content.memorize.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </Section>
      ) : null}

      {content.pitfalls?.length ? (
        <Section icon={AlertTriangle} title="Pièges fréquents">
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {content.pitfalls.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </Section>
      ) : null}

      {content.likely_exam_questions?.length ? (
        <Section icon={GraduationCap} title="Questions probables à l'examen">
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {content.likely_exam_questions.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </Section>
      ) : null}

      {content.days?.length ? (
        <Section icon={ListTree} title="Plan de révision">
          <ol className="space-y-2">
            {content.days.map((day) => (
              <li key={day.day} className="rounded-lg border bg-card p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">Jour {day.day} — {day.focus}</p>
                  <span className="text-xs text-muted-foreground">{day.estimated_minutes} min</span>
                </div>
                <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-sm text-muted-foreground">
                  {day.activities.map((activity) => <li key={activity}>{activity}</li>)}
                </ul>
              </li>
            ))}
          </ol>
        </Section>
      ) : null}
    </div>
  );
}
