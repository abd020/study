import {
  differenceInCalendarDays,
  format,
  formatDistanceToNowStrict,
  parseISO,
} from "date-fns";
import { fr } from "date-fns/locale";

export function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : parseISO(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value: string | Date | null | undefined, pattern = "d MMM yyyy"): string {
  const date = toDate(value);
  return date ? format(date, pattern, { locale: fr }) : "—";
}

export function formatDateTime(value: string | Date | null | undefined): string {
  const date = toDate(value);
  return date ? format(date, "d MMM yyyy 'à' HH:mm", { locale: fr }) : "—";
}

export function formatRelative(value: string | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return "jamais";
  return formatDistanceToNowStrict(date, { addSuffix: true, locale: fr });
}

export function daysUntil(value: string | Date | null | undefined): number | null {
  const date = toDate(value);
  if (!date) return null;
  return differenceInCalendarDays(date, new Date());
}

export function formatCountdown(value: string | Date | null | undefined): string {
  const days = daysUntil(value);
  if (days === null) return "—";
  if (days < 0) return `Il y a ${Math.abs(days)} jour${Math.abs(days) > 1 ? "s" : ""}`;
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return "Demain";
  return `Dans ${days} jours`;
}

/** 3725 → « 1 h 02 » ; 180 → « 3 min » */
export function formatDuration(seconds: number): string {
  if (!seconds || seconds < 60) return `${Math.max(0, Math.round(seconds))} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, "0")}`;
}

export function initials(firstName?: string | null, lastName?: string | null, email?: string | null): string {
  const a = firstName?.trim()?.[0];
  const b = lastName?.trim()?.[0];
  if (a || b) return `${a ?? ""}${b ?? ""}`.toUpperCase();
  return (email?.trim()?.[0] ?? "?").toUpperCase();
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count > 1 ? plural : singular}`;
}
