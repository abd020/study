-- =====================================================================
-- Revia — sécurité
-- RLS activée sur TOUTES les tables contenant des données utilisateur.
-- Les règles sont appliquées par PostgreSQL : le frontend n'est jamais
-- la seule barrière.
-- =====================================================================

-- ---------------------------------------------------------------------
-- has_role : SECURITY DEFINER pour éviter toute récursion RLS
-- ---------------------------------------------------------------------
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  );
$$;

revoke all on function public.has_role(uuid, public.app_role) from public;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;

-- ---------------------------------------------------------------------
-- Provisionnement automatique du profil à l'inscription
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, email, first_name, last_name, avatar_url)
  values (
    new.id,
    new.email,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'first_name', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'last_name', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'avatar_url', '')), '')
  )
  on conflict (id) do nothing;

  -- MVP : les deux comptes sont propriétaires de leurs données.
  insert into public.user_roles (user_id, role)
  values (new.id, 'owner')
  on conflict (user_id, role) do nothing;

  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Activation de RLS
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'user_roles', 'user_settings', 'courses', 'course_sections',
    'study_materials', 'study_summaries', 'flashcards', 'flashcard_progress',
    'quizzes', 'quiz_questions', 'quiz_attempts', 'quiz_answers', 'exams',
    'exam_sections', 'study_sessions', 'notifications', 'ai_generations'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- profiles : chacun lit et modifie son propre profil
-- ---------------------------------------------------------------------
create policy "profiles_select_own" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);
create policy "profiles_update_own" on public.profiles
  for update to authenticated using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- ---------------------------------------------------------------------
-- user_roles : lecture seule côté client. L'attribution des rôles se fait
-- par le trigger (SECURITY DEFINER) ou par la service_role.
-- ---------------------------------------------------------------------
create policy "user_roles_select_own" on public.user_roles
  for select to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------
-- user_settings
-- ---------------------------------------------------------------------
create policy "user_settings_select_own" on public.user_settings
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "user_settings_insert_own" on public.user_settings
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "user_settings_update_own" on public.user_settings
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------
-- Tables « possédées » : politique CRUD complète sur user_id
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'courses', 'course_sections', 'study_materials', 'study_summaries',
    'flashcards', 'flashcard_progress', 'quizzes', 'quiz_attempts', 'exams',
    'study_sessions', 'notifications', 'ai_generations'
  ]
  loop
    execute format($p$
      create policy "%1$s_select_own" on public.%1$I
        for select to authenticated using ((select auth.uid()) = user_id);
      create policy "%1$s_insert_own" on public.%1$I
        for insert to authenticated with check ((select auth.uid()) = user_id);
      create policy "%1$s_update_own" on public.%1$I
        for update to authenticated using ((select auth.uid()) = user_id)
        with check ((select auth.uid()) = user_id);
      create policy "%1$s_delete_own" on public.%1$I
        for delete to authenticated using ((select auth.uid()) = user_id);
    $p$, t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- Tables filles : la propriété est vérifiée via le parent
-- ---------------------------------------------------------------------
create policy "quiz_questions_select_own" on public.quiz_questions
  for select to authenticated using (
    exists (select 1 from public.quizzes q
            where q.id = quiz_id and q.user_id = (select auth.uid()))
  );
create policy "quiz_questions_insert_own" on public.quiz_questions
  for insert to authenticated with check (
    exists (select 1 from public.quizzes q
            where q.id = quiz_id and q.user_id = (select auth.uid()))
  );
create policy "quiz_questions_update_own" on public.quiz_questions
  for update to authenticated using (
    exists (select 1 from public.quizzes q
            where q.id = quiz_id and q.user_id = (select auth.uid()))
  ) with check (
    exists (select 1 from public.quizzes q
            where q.id = quiz_id and q.user_id = (select auth.uid()))
  );
create policy "quiz_questions_delete_own" on public.quiz_questions
  for delete to authenticated using (
    exists (select 1 from public.quizzes q
            where q.id = quiz_id and q.user_id = (select auth.uid()))
  );

create policy "quiz_answers_select_own" on public.quiz_answers
  for select to authenticated using (
    exists (select 1 from public.quiz_attempts a
            where a.id = attempt_id and a.user_id = (select auth.uid()))
  );
create policy "quiz_answers_insert_own" on public.quiz_answers
  for insert to authenticated with check (
    exists (select 1 from public.quiz_attempts a
            where a.id = attempt_id and a.user_id = (select auth.uid()))
  );
create policy "quiz_answers_update_own" on public.quiz_answers
  for update to authenticated using (
    exists (select 1 from public.quiz_attempts a
            where a.id = attempt_id and a.user_id = (select auth.uid()))
  ) with check (
    exists (select 1 from public.quiz_attempts a
            where a.id = attempt_id and a.user_id = (select auth.uid()))
  );
create policy "quiz_answers_delete_own" on public.quiz_answers
  for delete to authenticated using (
    exists (select 1 from public.quiz_attempts a
            where a.id = attempt_id and a.user_id = (select auth.uid()))
  );

create policy "exam_sections_select_own" on public.exam_sections
  for select to authenticated using (
    exists (select 1 from public.exams e
            where e.id = exam_id and e.user_id = (select auth.uid()))
  );
create policy "exam_sections_insert_own" on public.exam_sections
  for insert to authenticated with check (
    exists (select 1 from public.exams e
            where e.id = exam_id and e.user_id = (select auth.uid()))
    and exists (select 1 from public.course_sections s
            where s.id = section_id and s.user_id = (select auth.uid()))
  );
create policy "exam_sections_delete_own" on public.exam_sections
  for delete to authenticated using (
    exists (select 1 from public.exams e
            where e.id = exam_id and e.user_id = (select auth.uid()))
  );

-- ---------------------------------------------------------------------
-- Garde-fous d'intégrité : impossible de rattacher une ressource à un
-- cours ou un chapitre qui ne vous appartient pas (contrôle serveur).
-- ---------------------------------------------------------------------
create or replace function public.assert_owned_parents()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  d jsonb := to_jsonb(new);
  v_user uuid := nullif(d ->> 'user_id', '')::uuid;
  v_course uuid := nullif(d ->> 'course_id', '')::uuid;
  v_section uuid := nullif(d ->> 'section_id', '')::uuid;
  v_course_owner uuid;
  v_section_owner uuid;
  v_section_course uuid;
begin
  if v_course is not null then
    select user_id into v_course_owner from public.courses where id = v_course;
    if v_course_owner is null or v_course_owner <> v_user then
      raise exception 'Cours introuvable ou non autorisé' using errcode = '42501';
    end if;
  end if;

  if v_section is not null then
    select user_id, course_id into v_section_owner, v_section_course
      from public.course_sections where id = v_section;
    if v_section_owner is null or v_section_owner <> v_user then
      raise exception 'Chapitre introuvable ou non autorisé' using errcode = '42501';
    end if;
    if v_course is not null and v_section_course <> v_course then
      raise exception 'Le chapitre n''appartient pas à ce cours' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'course_sections', 'study_materials', 'study_summaries', 'flashcards',
    'quizzes', 'exams'
  ]
  loop
    execute format(
      'create trigger assert_owned_parents before insert or update on public.%I
         for each row execute function public.assert_owned_parents()', t);
  end loop;
end;
$$;

-- flashcard_progress : la carte doit appartenir à l'utilisateur
create or replace function public.assert_owned_flashcard()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner uuid;
begin
  select user_id into v_owner from public.flashcards where id = new.flashcard_id;
  if v_owner is null or v_owner <> new.user_id then
    raise exception 'Carte introuvable ou non autorisée' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger assert_owned_flashcard before insert or update on public.flashcard_progress
  for each row execute function public.assert_owned_flashcard();
