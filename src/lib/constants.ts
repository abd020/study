import type { Difficulty, ExamType, MaterialType, QuestionType, SessionType } from "@/types/database";

export const COURSE_COLORS = [
  "#4f46e5", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#14b8a6", "#64748b", "#f97316",
];

export const COURSE_ICONS = [
  "book-open", "calculator", "flask-conical", "trending-up", "scale",
  "globe", "code", "brain", "microscope", "palette", "landmark", "heart-pulse",
];

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: "Facile",
  medium: "Intermédiaire",
  hard: "Difficile",
};

export const EXAM_TYPE_LABELS: Record<ExamType, string> = {
  midterm: "Mi-session",
  final: "Final",
  quiz: "Quiz",
  assignment: "Travail",
  presentation: "Présentation",
  other: "Autre",
};

export const MATERIAL_TYPE_LABELS: Record<MaterialType, string> = {
  text: "Texte",
  notes: "Notes",
  pdf: "PDF",
  document: "Document",
  claude: "Généré avec Claude",
  manual: "Saisie manuelle",
};

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  multiple_choice: "Choix multiple",
  true_false: "Vrai / Faux",
  short_answer: "Réponse courte",
};

export const SESSION_TYPE_LABELS: Record<SessionType, string> = {
  flashcards: "Flashcards",
  quiz: "Quiz",
  quick_review: "Révision rapide",
  weak_topics: "Points faibles",
  exam_prep: "Révision avant examen",
  section_review: "Révision par chapitre",
};

export const WEEKDAYS = [
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mer" },
  { value: 4, label: "Jeu" },
  { value: 5, label: "Ven" },
  { value: 6, label: "Sam" },
  { value: 0, label: "Dim" },
];
