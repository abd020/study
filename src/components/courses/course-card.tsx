import { Link } from "react-router-dom";
import { CalendarClock, Layers, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CourseIcon } from "@/components/common/course-icon";
import { formatCountdown, formatRelative } from "@/lib/format";
import type { CourseOverview } from "@/types/database";

interface CourseCardProps {
  course: CourseOverview;
  onEdit?: (course: CourseOverview) => void;
  onDelete?: (course: CourseOverview) => void;
}

export function CourseCard({ course, onEdit, onDelete }: CourseCardProps) {
  return (
    <Card className="group relative flex flex-col p-5 transition-shadow hover:shadow-lifted">
      <div className="flex items-start gap-3">
        <CourseIcon icon={course.icon} color={course.color} />
        <div className="min-w-0 flex-1">
          <Link to={`/courses/${course.id}`} className="block focus:outline-none">
            <span className="absolute inset-0" aria-hidden />
            <h3 className="truncate text-[15px] font-semibold leading-tight">{course.name}</h3>
          </Link>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {[course.code, course.semester, course.professor].filter(Boolean).join(" · ") || "Sans code"}
          </p>
        </div>

        {onEdit || onDelete ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative z-10 h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100 data-[state=open]:opacity-100"
                aria-label="Actions du cours"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onEdit ? (
                <DropdownMenuItem onSelect={() => onEdit(course)}>
                  <Pencil /> Modifier
                </DropdownMenuItem>
              ) : null}
              {onDelete ? (
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={() => onDelete(course)}
                >
                  <Trash2 /> Supprimer
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Progression</span>
          <span className="font-medium">{course.progress} %</span>
        </div>
        <Progress value={course.progress} indicatorClassName="bg-[var(--course-color)]" style={{ ["--course-color" as string]: course.color }} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        <Badge variant="secondary">
          <Layers className="h-3 w-3" /> {course.flashcard_count} cartes
        </Badge>
        {course.due_count > 0 ? (
          <Badge variant="warning">{course.due_count} à réviser</Badge>
        ) : null}
        {course.next_exam_date ? (
          <Badge variant="outline">
            <CalendarClock className="h-3 w-3" /> {formatCountdown(course.next_exam_date)}
          </Badge>
        ) : null}
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Dernière révision : {formatRelative(course.last_reviewed_at)}
      </p>
    </Card>
  );
}
