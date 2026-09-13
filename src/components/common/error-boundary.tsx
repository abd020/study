import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Dernier filet de sécurité : sans lui, une exception au rendu laisse une
 * page entièrement blanche, sans indication pour l'utilisateur.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Visible dans la console du navigateur et dans les logs de l'hébergeur.
    console.error("Erreur non rattrapée :", error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex min-h-dvh items-center justify-center bg-background px-5 py-12">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <h1 className="mt-5 text-xl font-semibold tracking-tight">
            Une erreur est survenue
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            L'application n'a pas pu afficher cette page.
          </p>
          <pre className="mt-4 overflow-x-auto rounded-lg bg-muted p-3 text-left text-xs text-muted-foreground">
            {error.message}
          </pre>
          <div className="mt-6 flex justify-center gap-2">
            <Button onClick={() => this.setState({ error: null })}>
              <RefreshCw /> Réessayer
            </Button>
            <Button variant="outline" onClick={() => window.location.assign("/")}>
              Retour à l'accueil
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
