import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Database, Monitor, Moon, Sparkles, Sun, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/common/page-header";
import { LoadingScreen } from "@/components/common/loading";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { useSettings, useUpdateProfile, useUpdateSettings } from "@/hooks/use-account";
import { useAuth } from "@/hooks/use-auth";
import { useGenerations } from "@/hooks/use-ai";
import { removeDemoData, seedDemoData } from "@/services/account";
import { supabase, toMessage } from "@/lib/supabase";
import { DIFFICULTY_LABELS, WEEKDAYS } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";
import type { Difficulty } from "@/types/database";

export default function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") ?? "profile";

  const { profile, user, roles, signOut } = useAuth();
  const settingsQuery = useSettings();
  const updateSettings = useUpdateSettings();
  const updateProfile = useUpdateProfile();
  const generations = useGenerations();
  const { theme, setTheme } = useTheme();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [demoBusy, setDemoBusy] = useState(false);
  const [confirmRemoveDemo, setConfirmRemoveDemo] = useState(false);

  useEffect(() => {
    setFirstName(profile?.first_name ?? "");
    setLastName(profile?.last_name ?? "");
  }, [profile]);

  const settings = settingsQuery.data;
  if (settingsQuery.isLoading || !settings) return <LoadingScreen label="Chargement des préférences…" />;

  const patch = (input: Parameters<typeof updateSettings.mutate>[0]) => updateSettings.mutate(input);

  async function changePassword(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < 8) {
      toast.error("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast.error(toMessage(error));
      return;
    }
    setPassword("");
    toast.success("Mot de passe mis à jour.");
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Paramètres" description="Profil, révision, notifications, IA et apparence." />

      <Tabs value={tab} onValueChange={(value) => setSearchParams({ tab: value }, { replace: true })}>
        <div className="overflow-x-auto scrollbar-thin">
          <TabsList>
            <TabsTrigger value="profile">Profil</TabsTrigger>
            <TabsTrigger value="study">Révision</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="ai">IA</TabsTrigger>
            <TabsTrigger value="appearance">Apparence</TabsTrigger>
            <TabsTrigger value="data">Données</TabsTrigger>
          </TabsList>
        </div>

        {/* --- Profil --- */}
        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Informations personnelles</CardTitle>
              <CardDescription>
                {user?.email} · {roles.includes("owner") ? "Propriétaire" : roles.join(", ") || "Étudiant"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  updateProfile.mutate({
                    first_name: firstName.trim() || null,
                    last_name: lastName.trim() || null,
                  });
                }}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="first-name">Prénom</Label>
                    <Input id="first-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="last-name">Nom</Label>
                    <Input id="last-name" value={lastName} onChange={(event) => setLastName(event.target.value)} />
                  </div>
                </div>
                <Button type="submit" loading={updateProfile.isPending}>Enregistrer</Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sécurité</CardTitle>
              <CardDescription>Change ton mot de passe ou ferme ta session.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={changePassword}>
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="new-password">Nouveau mot de passe</Label>
                  <Input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="8 caractères minimum"
                  />
                </div>
                <Button type="submit" variant="outline" disabled={password.length < 8}>
                  Mettre à jour
                </Button>
              </form>

              <Button variant="ghost" className="text-destructive" onClick={() => void signOut()}>
                Se déconnecter
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- Révision --- */}
        <TabsContent value="study">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Préférences de révision</CardTitle>
              <CardDescription>
                Ces réglages pilotent la taille des sessions et l'objectif quotidien.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="session-duration">Durée d'une session (min)</Label>
                  <Input
                    id="session-duration"
                    type="number"
                    min={5}
                    max={240}
                    defaultValue={settings.session_duration_minutes}
                    onBlur={(event) =>
                      patch({ session_duration_minutes: Number(event.target.value) })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cards-per-session">Cartes par session</Label>
                  <Input
                    id="cards-per-session"
                    type="number"
                    min={5}
                    max={200}
                    defaultValue={settings.cards_per_session}
                    onBlur={(event) => patch({ cards_per_session: Number(event.target.value) })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="daily-goal">Objectif quotidien</Label>
                  <Input
                    id="daily-goal"
                    type="number"
                    min={5}
                    max={500}
                    defaultValue={settings.daily_goal_cards}
                    onBlur={(event) => patch({ daily_goal_cards: Number(event.target.value) })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Jours de révision préférés</Label>
                <div className="flex flex-wrap gap-1.5">
                  {WEEKDAYS.map((day) => {
                    const active = settings.preferred_study_days.includes(day.value);
                    return (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() =>
                          patch({
                            preferred_study_days: active
                              ? settings.preferred_study_days.filter((value) => value !== day.value)
                              : [...settings.preferred_study_days, day.value].sort(),
                          })
                        }
                        className={cn(
                          "rounded-lg border px-3 py-1.5 text-sm transition-colors",
                          active
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:bg-accent",
                        )}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- Notifications --- */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notifications internes</CardTitle>
              <CardDescription>
                Générées par la base de données, sans email ni appel externe.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Rappels de cartes dues</p>
                  <p className="text-xs text-muted-foreground">
                    Une notification quotidienne quand des cartes t'attendent.
                  </p>
                </div>
                <Switch
                  checked={settings.notify_due_reviews}
                  onCheckedChange={(checked) => patch({ notify_due_reviews: checked })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="exam-days">Prévenir avant un examen (jours)</Label>
                <Input
                  id="exam-days"
                  type="number"
                  min={1}
                  max={60}
                  className="max-w-[160px]"
                  defaultValue={settings.notify_exam_days_before}
                  onBlur={(event) => patch({ notify_exam_days_before: Number(event.target.value) })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- IA --- */}
        <TabsContent value="ai" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-primary" /> Génération avec Claude
              </CardTitle>
              <CardDescription>
                Claude n'est appelé que lorsque tu le demandes explicitement. La clé API reste côté
                serveur, dans les secrets Supabase.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="ai-count">Nombre de cartes par défaut</Label>
                  <Input
                    id="ai-count"
                    type="number"
                    min={5}
                    max={50}
                    defaultValue={settings.ai_default_card_count}
                    onBlur={(event) => patch({ ai_default_card_count: Number(event.target.value) })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Difficulté par défaut</Label>
                  <Select
                    value={settings.ai_default_difficulty}
                    onValueChange={(value) => patch({ ai_default_difficulty: value as Difficulty })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(DIFFICULTY_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Rester strictement dans le cours</p>
                  <p className="text-xs text-muted-foreground">
                    Claude signale explicitement toute information absente de ton matériel.
                  </p>
                </div>
                <Switch
                  checked={settings.ai_strict_context}
                  onCheckedChange={(checked) => patch({ ai_strict_context: checked })}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Historique des générations</CardTitle>
              <CardDescription>Utile pour suivre l'usage et éviter les doublons.</CardDescription>
            </CardHeader>
            <CardContent>
              {(generations.data?.length ?? 0) === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Aucune génération pour le moment.
                </p>
              ) : (
                <ul className="divide-y">
                  {(generations.data ?? []).slice(0, 15).map((generation) => (
                    <li key={generation.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{generation.generation_type}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(generation.created_at)} · {generation.model}
                        </p>
                      </div>
                      <Badge
                        variant={
                          generation.status === "success"
                            ? "success"
                            : generation.status === "error"
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {generation.status === "success"
                          ? `${generation.items_created} élément(s)`
                          : generation.status === "error"
                          ? "Échec"
                          : "En cours"}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- Apparence --- */}
        <TabsContent value="appearance">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Thème</CardTitle>
              <CardDescription>Clair, sombre, ou aligné sur ton système.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { value: "light" as const, label: "Clair", icon: Sun },
                  { value: "dark" as const, label: "Sombre", icon: Moon },
                  { value: "system" as const, label: "Système", icon: Monitor },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setTheme(option.value);
                      patch({ theme: option.value });
                    }}
                    className={cn(
                      "flex flex-col items-center gap-2 rounded-xl border-2 px-4 py-5 transition-colors",
                      theme === option.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-accent/50",
                    )}
                  >
                    <option.icon className="h-5 w-5" />
                    <span className="text-sm font-medium">{option.label}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- Données --- */}
        <TabsContent value="data">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Database className="h-4 w-4 text-muted-foreground" /> Données de démonstration
              </CardTitle>
              <CardDescription>
                Un cours d'exemple avec quatre chapitres, quelques cartes et un examen. À supprimer
                dès que tu as saisi tes vrais cours.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                loading={demoBusy}
                onClick={async () => {
                  setDemoBusy(true);
                  try {
                    const result = await seedDemoData();
                    toast[result.created ? "success" : "info"](
                      result.created
                        ? "Cours de démonstration créé."
                        : "Le cours de démonstration existe déjà.",
                    );
                  } catch (error) {
                    toast.error(toMessage(error));
                  } finally {
                    setDemoBusy(false);
                  }
                }}
              >
                Créer les données de démonstration
              </Button>

              <Button
                variant="ghost"
                className="text-destructive"
                onClick={() => setConfirmRemoveDemo(true)}
              >
                <Trash2 /> Supprimer les données de démonstration
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={confirmRemoveDemo}
        onOpenChange={setConfirmRemoveDemo}
        title="Supprimer le cours de démonstration ?"
        description="Seul le cours « Finance (démo) » et son contenu seront supprimés."
        confirmLabel="Supprimer"
        destructive
        onConfirm={async () => {
          setConfirmRemoveDemo(false);
          try {
            const result = await removeDemoData();
            toast.success(
              result.deleted > 0 ? "Données de démonstration supprimées." : "Rien à supprimer.",
            );
          } catch (error) {
            toast.error(toMessage(error));
          }
        }}
      />
    </div>
  );
}
