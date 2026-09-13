import { createContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { getProfile, getRoles } from "@/services/account";
import type { AppRole, Profile } from "@/types/database";

export interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  roles: AppRole[];
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const user = session?.user ?? null;

  async function loadProfile(userId: string) {
    try {
      const [profileRow, roleRows] = await Promise.all([getProfile(userId), getRoles(userId)]);
      setProfile(profileRow);
      setRoles(roleRows);
    } catch {
      // Profil indisponible (réseau, session expirée) : l'application reste
      // utilisable, le nom affiché retombe simplement sur l'email.
      setProfile(null);
      setRoles([]);
    }
  }

  useEffect(() => {
    let active = true;

    // 1. L'écouteur est enregistré avant la lecture de la session pour ne
    //    manquer aucun événement (connexion, refresh de token, déconnexion).
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      if (!nextSession?.user) {
        setProfile(null);
        setRoles([]);
        setLoading(false);
        return;
      }
      // Les appels Supabase sont différés hors du callback pour éviter tout
      // blocage du client auth.
      setTimeout(() => {
        if (active) void loadProfile(nextSession.user.id).finally(() => setLoading(false));
      }, 0);
    });

    // 2. Session déjà présente (rechargement de page).
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (data.session?.user) {
        await loadProfile(data.session.user.id);
      }
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      profile,
      roles,
      loading,
      refreshProfile: async () => {
        if (user) await loadProfile(user.id);
      },
      signOut: async () => {
        await supabase.auth.signOut();
        setProfile(null);
        setRoles([]);
      },
    }),
    [session, user, profile, roles, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
