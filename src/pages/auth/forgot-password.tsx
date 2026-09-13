import { useState } from "react";
import { Link } from "react-router-dom";
import { MailCheck } from "lucide-react";
import { AuthLayout } from "@/pages/auth/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase, toMessage } from "@/lib/supabase";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setLoading(false);
    if (resetError) {
      setError(toMessage(resetError));
      return;
    }
    setSent(true);
  }

  return (
    <AuthLayout
      title="Mot de passe oublié"
      description="On t'envoie un lien pour en définir un nouveau."
      footer={
        <Link to="/login" className="font-medium text-primary hover:underline">
          Retour à la connexion
        </Link>
      }
    >
      {sent ? (
        <div className="rounded-lg border border-success/30 bg-success/5 p-4">
          <MailCheck className="h-5 w-5 text-success" />
          <p className="mt-2 text-sm font-medium">Email envoyé</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Si un compte existe pour {email}, un lien de réinitialisation vient d'être envoyé.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="prenom@exemple.com"
            />
          </div>

          {error ? (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          ) : null}

          <Button type="submit" className="w-full" loading={loading}>
            Envoyer le lien
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
