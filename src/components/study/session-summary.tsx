import { CheckCircle2, Clock, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDuration } from "@/lib/format";

interface SessionSummaryProps {
  tally: { again: number; hard: number; good: number; easy: number };
  durationSeconds: number;
  total: number;
  onExit: () => void;
}

export function SessionSummary({ tally, durationSeconds, total, onExit }: SessionSummaryProps) {
  const mastered = tally.good + tally.easy;
  const reviewed = mastered + tally.again + tally.hard;
  const accuracy = reviewed > 0 ? Math.round((mastered * 100) / reviewed) : 0;

  return (
    <div className="mx-auto w-full max-w-2xl">
      <Card className="p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-success/10 text-success">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <h2 className="mt-4 text-xl font-semibold tracking-tight">Session terminée</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {reviewed} carte{reviewed > 1 ? "s" : ""} sur {total} revue{reviewed > 1 ? "s" : ""} · {accuracy} % de réussite
        </p>

        <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Maîtrisées" value={tally.easy} tone="text-success" />
          <Stat label="Bien" value={tally.good} tone="text-primary" />
          <Stat label="Difficiles" value={tally.hard} tone="text-warning" />
          <Stat label="À revoir" value={tally.again} tone="text-destructive" />
        </div>

        <div className="mt-6 flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" /> {formatDuration(durationSeconds)} de révision
        </div>

        <div className="mt-7 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button onClick={onExit}>
            <Sparkles /> Retour aux révisions
          </Button>
          <Button variant="outline" onClick={() => window.location.reload()}>
            <RotateCcw /> Nouvelle session
          </Button>
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className={`text-2xl font-semibold ${tone}`}>{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
