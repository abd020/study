import { useContext } from "react";
import { AuthContext } from "@/providers/auth-provider";

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth doit être utilisé dans un AuthProvider.");
  return context;
}

/** Identifiant de l'utilisateur connecté — lève une erreur si absent. */
export function useUserId(): string {
  const { user } = useAuth();
  if (!user) throw new Error("Aucun utilisateur connecté.");
  return user.id;
}
