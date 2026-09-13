/**
 * Types TypeScript correspondant au schéma Supabase.
 * À garder synchronisé avec supabase/migrations/*.sql
 * (ou régénérer : `supabase gen types typescript --local > src/types/database.ts`)
 */

export type AppRole = "owner" | "admin" | "student";
export type MaterialType = "text" | "notes" | "pdf" | "document" | "claude" | "manual";
export type Difficulty = "easy" | "medium" | "hard";
export type ContentOrigin = "manual" | "claude";
export type CardStatus = "new" | "learning" | "review" | "mastered" | "lapsed";
export type ExamType = "midterm" | "final" | "quiz" | "assignment" | "presentation" | "other";
export type QuestionType = "multiple_choice" | "true_false" | "short_answer";
export type GenerationType =
  | "summary"
  | "flashcards"
  | "quiz"
  | "key_concepts"
  | "study_plan"
  | "explanation";
export type GenerationStatus = "pending" | "success" | "error";
export type SessionType =
  | "flashcards"
  | "quiz"
  | "quick_review"
  | "weak_topics"
  | "exam_prep"
  | "section_review";
export type NotificationType =
  | "exam_reminder"
  | "review_due"
  | "streak"
  | "achievement"
  | "system";

export interface Profile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

export interface UserSettings {
  user_id: string;
  session_duration_minutes: number;
  cards_per_session: number;
  daily_goal_cards: number;
  preferred_study_days: number[];
  notify_exam_days_before: number;
  notify_due_reviews: boolean;
  ai_default_card_count: number;
  ai_default_difficulty: Difficulty;
  ai_strict_context: boolean;
  theme: "light" | "dark" | "system";
  locale: string;
  created_at: string;
  updated_at: string;
}

export interface Course {
  id: string;
  user_id: string;
  name: string;
  code: string | null;
  professor: string | null;
  institution: string | null;
  semester: string | null;
  description: string | null;
  color: string;
  icon: string;
  start_date: string | null;
  end_date: string | null;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface CourseOverview extends Course {
  section_count: number;
  material_count: number;
  flashcard_count: number;
  mastered_count: number;
  due_count: number;
  new_count: number;
  last_reviewed_at: string | null;
  progress: number;
  avg_score: number | null;
  next_exam_id: string | null;
  next_exam_title: string | null;
  next_exam_date: string | null;
}

export interface CourseSection {
  id: string;
  course_id: string;
  user_id: string;
  title: string;
  description: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface StudyMaterial {
  id: string;
  user_id: string;
  course_id: string;
  section_id: string | null;
  title: string;
  type: MaterialType;
  raw_content: string | null;
  processed_content: string | null;
  file_url: string | null;
  source: string | null;
  created_at: string;
  updated_at: string;
}

export interface SummaryContent {
  kind?: GenerationType;
  title?: string;
  overview?: string;
  key_concepts?: { name: string; description: string }[];
  definitions?: { term: string; definition: string }[];
  formulas?: { expression: string; meaning: string }[];
  memorize?: string[];
  pitfalls?: string[];
  likely_exam_questions?: string[];
  concepts?: { name: string; description: string; importance: "low" | "medium" | "high" }[];
  days?: { day: number; focus: string; activities: string[]; estimated_minutes: number }[];
}

export interface StudySummary {
  id: string;
  user_id: string;
  course_id: string;
  section_id: string | null;
  title: string;
  content: SummaryContent;
  generated_by: ContentOrigin;
  created_at: string;
  updated_at: string;
}

export interface Flashcard {
  id: string;
  user_id: string;
  course_id: string;
  section_id: string | null;
  question: string;
  answer: string;
  explanation: string | null;
  difficulty: Difficulty;
  topic: string | null;
  created_by: ContentOrigin;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface FlashcardProgress {
  id: string;
  user_id: string;
  flashcard_id: string;
  repetitions: number;
  ease_factor: number;
  interval_days: number;
  next_review_at: string;
  last_reviewed_at: string | null;
  status: CardStatus;
  correct_count: number;
  incorrect_count: number;
  lapses: number;
  created_at: string;
  updated_at: string;
}

/** Ligne renvoyée par get_due_flashcards / build_exam_session */
export interface StudyCard {
  id: string;
  course_id: string;
  section_id: string | null;
  course_name: string;
  course_color: string;
  section_title: string | null;
  question: string;
  answer: string;
  explanation: string | null;
  difficulty: Difficulty;
  topic: string | null;
  status: CardStatus;
  repetitions?: number;
  ease_factor?: number;
  interval_days?: number;
  next_review_at?: string;
  progress_id?: string | null;
  reason?: string;
  priority?: number;
}

export interface Quiz {
  id: string;
  user_id: string;
  course_id: string;
  section_id: string | null;
  title: string;
  description: string | null;
  difficulty: Difficulty;
  created_by: ContentOrigin;
  created_at: string;
  updated_at: string;
}

export interface QuizQuestion {
  id: string;
  quiz_id: string;
  position: number;
  question: string;
  question_type: QuestionType;
  choices: string[];
  correct_answer: string;
  explanation: string | null;
  topic: string | null;
  difficulty: Difficulty;
  created_at: string;
}

export interface QuizAttempt {
  id: string;
  user_id: string;
  quiz_id: string;
  score: number;
  total_questions: number;
  started_at: string;
  completed_at: string | null;
}

export interface QuizAnswer {
  id: string;
  attempt_id: string;
  question_id: string;
  user_answer: string | null;
  is_correct: boolean;
  answered_at: string;
}

export interface Exam {
  id: string;
  user_id: string;
  course_id: string;
  title: string;
  exam_type: ExamType;
  exam_date: string;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  description: string | null;
  weight_percentage: number | null;
  created_at: string;
  updated_at: string;
}

export interface ExamWithCourse extends Exam {
  course: Pick<Course, "id" | "name" | "color" | "code"> | null;
}

export interface ExamSection {
  id: string;
  exam_id: string;
  section_id: string;
}

export interface StudySession {
  id: string;
  user_id: string;
  course_id: string | null;
  exam_id: string | null;
  session_type: SessionType;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number;
  cards_reviewed: number;
  questions_answered: number;
  correct_answers: number;
  created_at: string;
}

export interface AppNotification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string | null;
  read: boolean;
  related_entity_id: string | null;
  dedupe_key: string | null;
  created_at: string;
}

export interface AiGeneration {
  id: string;
  user_id: string;
  course_id: string | null;
  section_id: string | null;
  generation_type: GenerationType;
  input_hash: string;
  model: string;
  status: GenerationStatus;
  result_id: string | null;
  items_created: number;
  input_tokens: number | null;
  output_tokens: number | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

// --- Retours des fonctions RPC ---------------------------------------------

export interface WeakTopic {
  topic: string;
  course_id: string;
  course_name: string;
  course_color: string;
  mastery: number;
  cards_total: number;
  cards_struggling: number;
  cards_never_reviewed: number;
  quiz_answered: number;
  quiz_correct: number;
  last_reviewed_at: string | null;
}

export interface DashboardSummary {
  due_today: number;
  new_today: number;
  cards_total: number;
  cards_mastered: number;
  cards_review: number;
  cards_learning: number;
  global_progress: number;
  seconds_this_week: number;
  sessions_this_week: number;
  cards_this_week: number;
  seconds_today: number;
  cards_today: number;
  streak_days: number;
  next_exam: {
    id: string;
    title: string;
    exam_date: string;
    exam_type: ExamType;
    start_time: string | null;
    location: string | null;
    course_id: string;
    course_name: string;
    course_color: string;
    days_remaining: number;
  } | null;
}

export interface ExamReadiness {
  exam_id: string;
  readiness: number;
  days_remaining: number;
  cards_total: number;
  cards_mastered: number;
  cards_review: number;
  cards_learning: number;
  cards_new: number;
  quiz_score: number | null;
  weak_topics: number;
  sections_total: number;
  sections_covered: number;
  recommended_daily_cards: number;
  error?: string;
}

export interface ProgressOverview {
  daily: { day: string; seconds: number; cards: number; questions: number; correct: number }[];
  total_seconds: number;
  total_sessions: number;
  total_cards_reviewed: number;
  total_questions: number;
  total_correct: number;
  cards_total: number;
  cards_studied: number;
  cards_mastered: number;
  quiz_avg_score: number | null;
  quiz_attempts: number;
  by_course: {
    id: string;
    name: string;
    color: string;
    progress: number;
    flashcard_count: number;
    mastered_count: number;
    due_count: number;
    avg_score: number | null;
  }[];
  by_section: {
    id: string;
    title: string;
    course_id: string;
    course_name: string;
    course_color: string;
    cards_total: number;
    cards_mastered: number;
    mastery: number;
  }[];
}

export interface SearchResult {
  kind: "course" | "section" | "flashcard" | "summary" | "material" | "exam" | "quiz";
  id: string;
  title: string;
  subtitle: string | null;
  course_id: string;
  course_name: string;
  course_color: string;
  section_id: string | null;
}
