-- =====================================================================
-- Revia — schéma initial
-- Tables, types, contraintes, index et triggers.
-- La sécurité (RLS) est définie dans la migration suivante.
-- =====================================================================

create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

-- ---------------------------------------------------------------------
-- Types énumérés
-- ---------------------------------------------------------------------
create type public.app_role as enum ('owner', 'admin', 'student');
create type public.material_type as enum ('text', 'notes', 'pdf', 'document', 'claude', 'manual');
create type public.difficulty_level as enum ('easy', 'medium', 'hard');
create type public.content_origin as enum ('manual', 'claude');
create type public.card_status as enum ('new', 'learning', 'review', 'mastered', 'lapsed');
create type public.exam_type as enum ('midterm', 'final', 'quiz', 'assignment', 'presentation', 'other');
create type public.question_type as enum ('multiple_choice', 'true_false', 'short_answer');
create type public.generation_type as enum ('summary', 'flashcards', 'quiz', 'key_concepts', 'study_plan', 'explanation');
create type public.generation_status as enum ('pending', 'success', 'error');
create type public.session_type as enum ('flashcards', 'quiz', 'quick_review', 'weak_topics', 'exam_prep', 'section_review');
create type public.notification_type as enum ('exam_reminder', 'review_due', 'streak', 'achievement', 'system');

-- ---------------------------------------------------------------------
-- Fonction utilitaire : updated_at
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- profiles / rôles
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  first_name text,
  last_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null default 'student',
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

create index user_roles_user_id_idx on public.user_roles (user_id);

-- Préférences utilisateur (révision, notifications, IA, apparence)
create table public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  session_duration_minutes int not null default 25 check (session_duration_minutes between 5 and 240),
  cards_per_session int not null default 20 check (cards_per_session between 5 and 200),
  daily_goal_cards int not null default 30 check (daily_goal_cards between 5 and 500),
  preferred_study_days smallint[] not null default '{1,2,3,4,5}',
  notify_exam_days_before int not null default 7 check (notify_exam_days_before between 1 and 60),
  notify_due_reviews boolean not null default true,
  ai_default_card_count int not null default 15 check (ai_default_card_count between 5 and 50),
  ai_default_difficulty public.difficulty_level not null default 'medium',
  ai_strict_context boolean not null default true,
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  locale text not null default 'fr',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Cours & structure
-- ---------------------------------------------------------------------
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 160),
  code text,
  professor text,
  institution text,
  semester text,
  description text,
  color text not null default '#4f46e5',
  icon text not null default 'book-open',
  start_date date,
  end_date date,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint courses_dates_valid check (start_date is null or end_date is null or end_date >= start_date)
);

create index courses_user_id_idx on public.courses (user_id);
create index courses_user_archived_idx on public.courses (user_id, archived);

create table public.course_sections (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 200),
  description text,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index course_sections_course_id_idx on public.course_sections (course_id, position);
create index course_sections_user_id_idx on public.course_sections (user_id);

-- ---------------------------------------------------------------------
-- Contenus pédagogiques
-- ---------------------------------------------------------------------
create table public.study_materials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  section_id uuid references public.course_sections (id) on delete set null,
  title text not null check (char_length(trim(title)) between 1 and 200),
  type public.material_type not null default 'text',
  raw_content text,
  processed_content text,
  file_url text,
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index study_materials_user_id_idx on public.study_materials (user_id);
create index study_materials_course_id_idx on public.study_materials (course_id);
create index study_materials_section_id_idx on public.study_materials (section_id);

create table public.study_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  section_id uuid references public.course_sections (id) on delete cascade,
  title text not null,
  content jsonb not null default '{}'::jsonb,
  generated_by public.content_origin not null default 'claude',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index study_summaries_user_id_idx on public.study_summaries (user_id);
create index study_summaries_course_id_idx on public.study_summaries (course_id);
create index study_summaries_section_id_idx on public.study_summaries (section_id);

-- ---------------------------------------------------------------------
-- Flashcards & répétition espacée
-- ---------------------------------------------------------------------
create table public.flashcards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  section_id uuid references public.course_sections (id) on delete set null,
  question text not null check (char_length(trim(question)) > 0),
  answer text not null check (char_length(trim(answer)) > 0),
  explanation text,
  difficulty public.difficulty_level not null default 'medium',
  topic text,
  created_by public.content_origin not null default 'manual',
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index flashcards_user_id_idx on public.flashcards (user_id);
create index flashcards_course_id_idx on public.flashcards (course_id);
create index flashcards_section_id_idx on public.flashcards (section_id);
create index flashcards_topic_idx on public.flashcards (user_id, topic);

create table public.flashcard_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  flashcard_id uuid not null references public.flashcards (id) on delete cascade,
  repetitions int not null default 0 check (repetitions >= 0),
  ease_factor numeric(4, 2) not null default 2.50 check (ease_factor >= 1.30),
  interval_days numeric(6, 2) not null default 0 check (interval_days >= 0),
  next_review_at timestamptz not null default now(),
  last_reviewed_at timestamptz,
  status public.card_status not null default 'new',
  correct_count int not null default 0 check (correct_count >= 0),
  incorrect_count int not null default 0 check (incorrect_count >= 0),
  lapses int not null default 0 check (lapses >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, flashcard_id)
);

create index flashcard_progress_user_next_review_idx
  on public.flashcard_progress (user_id, next_review_at);
create index flashcard_progress_flashcard_id_idx on public.flashcard_progress (flashcard_id);
create index flashcard_progress_status_idx on public.flashcard_progress (user_id, status);

-- ---------------------------------------------------------------------
-- Quiz
-- ---------------------------------------------------------------------
create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  section_id uuid references public.course_sections (id) on delete set null,
  title text not null,
  description text,
  difficulty public.difficulty_level not null default 'medium',
  created_by public.content_origin not null default 'claude',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index quizzes_user_id_idx on public.quizzes (user_id);
create index quizzes_course_id_idx on public.quizzes (course_id);
create index quizzes_section_id_idx on public.quizzes (section_id);

create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes (id) on delete cascade,
  position int not null default 0,
  question text not null,
  question_type public.question_type not null default 'multiple_choice',
  choices jsonb not null default '[]'::jsonb,
  correct_answer text not null,
  explanation text,
  topic text,
  difficulty public.difficulty_level not null default 'medium',
  created_at timestamptz not null default now()
);

create index quiz_questions_quiz_id_idx on public.quiz_questions (quiz_id, position);
create index quiz_questions_topic_idx on public.quiz_questions (topic);

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  quiz_id uuid not null references public.quizzes (id) on delete cascade,
  score int not null default 0 check (score >= 0),
  total_questions int not null default 0 check (total_questions >= 0),
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index quiz_attempts_user_id_idx on public.quiz_attempts (user_id, started_at desc);
create index quiz_attempts_quiz_id_idx on public.quiz_attempts (quiz_id);

create table public.quiz_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.quiz_attempts (id) on delete cascade,
  question_id uuid not null references public.quiz_questions (id) on delete cascade,
  user_answer text,
  is_correct boolean not null default false,
  answered_at timestamptz not null default now(),
  unique (attempt_id, question_id)
);

create index quiz_answers_attempt_id_idx on public.quiz_answers (attempt_id);
create index quiz_answers_question_id_idx on public.quiz_answers (question_id);

-- ---------------------------------------------------------------------
-- Examens
-- ---------------------------------------------------------------------
create table public.exams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  title text not null,
  exam_type public.exam_type not null default 'midterm',
  exam_date date not null,
  start_time time,
  end_time time,
  location text,
  description text,
  weight_percentage numeric(5, 2) check (weight_percentage is null or (weight_percentage >= 0 and weight_percentage <= 100)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index exams_user_id_idx on public.exams (user_id);
create index exams_course_id_idx on public.exams (course_id);
create index exams_exam_date_idx on public.exams (exam_date);
create index exams_user_date_idx on public.exams (user_id, exam_date);

create table public.exam_sections (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams (id) on delete cascade,
  section_id uuid not null references public.course_sections (id) on delete cascade,
  unique (exam_id, section_id)
);

create index exam_sections_exam_id_idx on public.exam_sections (exam_id);
create index exam_sections_section_id_idx on public.exam_sections (section_id);

-- ---------------------------------------------------------------------
-- Sessions de révision
-- ---------------------------------------------------------------------
create table public.study_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  course_id uuid references public.courses (id) on delete set null,
  exam_id uuid references public.exams (id) on delete set null,
  session_type public.session_type not null default 'flashcards',
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds int not null default 0 check (duration_seconds >= 0),
  cards_reviewed int not null default 0 check (cards_reviewed >= 0),
  questions_answered int not null default 0 check (questions_answered >= 0),
  correct_answers int not null default 0 check (correct_answers >= 0),
  created_at timestamptz not null default now()
);

create index study_sessions_user_id_idx on public.study_sessions (user_id, started_at desc);
create index study_sessions_course_id_idx on public.study_sessions (course_id);

-- ---------------------------------------------------------------------
-- Notifications internes
-- ---------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type public.notification_type not null default 'system',
  title text not null,
  message text,
  read boolean not null default false,
  related_entity_id uuid,
  dedupe_key text,
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);

create index notifications_user_id_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id, read);

-- ---------------------------------------------------------------------
-- Historique des générations IA
-- ---------------------------------------------------------------------
create table public.ai_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  course_id uuid references public.courses (id) on delete cascade,
  section_id uuid references public.course_sections (id) on delete set null,
  generation_type public.generation_type not null,
  input_hash text not null,
  model text not null,
  status public.generation_status not null default 'pending',
  result_id uuid,
  items_created int not null default 0,
  input_tokens int,
  output_tokens int,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index ai_generations_user_id_idx on public.ai_generations (user_id, created_at desc);
create index ai_generations_course_id_idx on public.ai_generations (course_id);
create index ai_generations_hash_idx on public.ai_generations (user_id, generation_type, input_hash);

-- ---------------------------------------------------------------------
-- Triggers updated_at
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'user_settings', 'courses', 'course_sections', 'study_materials',
    'study_summaries', 'flashcards', 'flashcard_progress', 'quizzes', 'exams'
  ]
  loop
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()', t);
  end loop;
end;
$$;
