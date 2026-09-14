import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConfigError } from "@/components/common/config-error";
import { missingEnvVars } from "@/lib/env";
import { ThemeProvider } from "@/providers/theme-provider";
import "@/index.css";

const container = document.getElementById("root");
if (!container) throw new Error("Élément #root introuvable.");

const root = createRoot(container);
const missing = missingEnvVars();

if (missing.length > 0) {
  // `@/App` importe le client Supabase, dont la création échoue sans ces
  // variables. On l'importe donc seulement une fois la configuration vérifiée,
  // sinon la page resterait blanche avec une simple erreur en console.
  root.render(
    <StrictMode>
      <ThemeProvider>
        <ConfigError missing={missing} />
      </ThemeProvider>
    </StrictMode>,
  );
} else {
  void import("@/App").then(({ default: App }) => {
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  });
}
