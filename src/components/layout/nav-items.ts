import {
  BarChart3, BookOpen, CalendarDays, LayoutDashboard, Layers, ListChecks, Sparkles,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

export const MAIN_NAV: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/courses", label: "Mes cours", icon: BookOpen },
  { to: "/study", label: "Réviser", icon: Sparkles },
  { to: "/study/flashcards", label: "Flashcards", icon: Layers },
  { to: "/quizzes", label: "Quiz", icon: ListChecks },
  { to: "/calendar", label: "Calendrier", icon: CalendarDays },
  { to: "/progress", label: "Progression", icon: BarChart3 },
];

/** Navigation mobile : les entrées les plus utilisées. */
export const MOBILE_NAV: NavItem[] = [
  MAIN_NAV[0],
  MAIN_NAV[1],
  MAIN_NAV[2],
  MAIN_NAV[5],
  MAIN_NAV[6],
];
