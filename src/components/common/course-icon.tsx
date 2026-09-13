import {
  Book, BookOpen, Brain, Calculator, Code, FlaskConical, Globe, HeartPulse,
  Landmark, Microscope, Palette, Scale, TrendingUp, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  "book-open": BookOpen,
  calculator: Calculator,
  "flask-conical": FlaskConical,
  "trending-up": TrendingUp,
  scale: Scale,
  globe: Globe,
  code: Code,
  brain: Brain,
  microscope: Microscope,
  palette: Palette,
  landmark: Landmark,
  "heart-pulse": HeartPulse,
};

export function getCourseIcon(name: string): LucideIcon {
  return ICONS[name] ?? Book;
}

export function CourseIcon({
  icon,
  color,
  className,
  size = "md",
}: {
  icon: string;
  color: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const Icon = getCourseIcon(icon);
  const box = size === "sm" ? "h-7 w-7" : size === "lg" ? "h-11 w-11" : "h-9 w-9";
  const glyph = size === "sm" ? "h-3.5 w-3.5" : size === "lg" ? "h-5 w-5" : "h-4 w-4";

  return (
    <div
      className={cn("flex shrink-0 items-center justify-center rounded-lg", box, className)}
      style={{ backgroundColor: `${color}1a`, color }}
    >
      <Icon className={glyph} />
    </div>
  );
}
