\set ON_ERROR_STOP on
\timing off

-- Les deux comptes de test sont créés par scripts/test-db.sh.
\echo '== 1. Trigger handle_new_user : profil, rôle owner, préférences =='
select
  (select count(*) from public.profiles)      as profiles,
  (select count(*) from public.user_roles where role = 'owner') as owners,
  (select count(*) from public.user_settings) as settings;

\echo '== 2. Données de démonstration créées par Alice =='
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select public.seed_demo_data() ->> 'created' as demo_created;

select count(*) as alice_courses from public.courses;
select count(*) as alice_sections from public.course_sections;
select count(*) as alice_cards from public.flashcards;
select count(*) as alice_exams from public.exams;

\echo '== 3. RLS : Bob ne voit rien d''Alice =='
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select
  (select count(*) from public.courses)         as bob_sees_courses,
  (select count(*) from public.flashcards)      as bob_sees_cards,
  (select count(*) from public.course_overview) as bob_sees_overview,
  (select count(*) from public.exams)           as bob_sees_exams;

\echo '== 4. RLS : Bob ne peut pas insérer pour Alice (doit échouer) =='
do $$
begin
  insert into public.courses (user_id, name)
  values ('11111111-1111-1111-1111-111111111111', 'Piratage');
  raise exception 'FAILLE : insertion cross-user acceptée';
exception
  when insufficient_privilege or check_violation then
    raise notice 'OK : insertion cross-user refusée (%)', sqlerrm;
end;
$$;

\echo '== 5. RLS : Bob ne peut pas rattacher une carte au cours d''Alice =='
do $$
declare v_course uuid;
begin
  insert into public.courses (user_id, name, code) values (auth.uid(), 'Cours de Bob', 'BOB-1')
  returning id into v_course;
  -- tentative de rattachement au cours d'Alice
  begin
    insert into public.flashcards (user_id, course_id, question, answer)
    select auth.uid(), c.id, 'q', 'r' from public.courses c where c.code = 'DEMO-FIN';
    raise notice 'aucune ligne insérée (cours d''Alice invisible) : OK';
  exception when insufficient_privilege then
    raise notice 'OK : rattachement refusé';
  end;
end;
$$;

\echo '== 6. Alice : vue course_overview =='
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select name, section_count, material_count, flashcard_count, due_count, progress, next_exam_date
from public.course_overview;

\echo '== 7. get_due_flashcards =='
select count(*) as due_cards from public.get_due_flashcards(null, null, 50, true);
select question, status, course_name from public.get_due_flashcards(null, null, 2, true);

\echo '== 8. get_dashboard_summary =='
select jsonb_pretty(public.get_dashboard_summary());

\echo '== 9. Simulation de révisions (SM-2 appliqué côté application) =='
insert into public.flashcard_progress
  (user_id, flashcard_id, repetitions, ease_factor, interval_days, next_review_at, last_reviewed_at, status, correct_count, incorrect_count)
select auth.uid(), f.id, 3, 2.5, 15, now() + interval '15 days', now(), 'review', 3, 0
from public.flashcards f where f.topic = 'Valeur temporelle';

insert into public.flashcard_progress
  (user_id, flashcard_id, repetitions, ease_factor, interval_days, next_review_at, last_reviewed_at, status, correct_count, incorrect_count, lapses)
select auth.uid(), f.id, 0, 1.8, 0.01, now(), now(), 'lapsed', 1, 4, 2
from public.flashcards f where f.topic = 'Obligations';

insert into public.study_sessions (user_id, course_id, session_type, started_at, ended_at, duration_seconds, cards_reviewed, questions_answered, correct_answers)
select auth.uid(), c.id, 'flashcards', now() - interval '1 day', now() - interval '1 day', 1500, 12, 12, 9
from public.courses c where c.code = 'DEMO-FIN';
insert into public.study_sessions (user_id, course_id, session_type, started_at, ended_at, duration_seconds, cards_reviewed, questions_answered, correct_answers)
select auth.uid(), c.id, 'flashcards', now(), now(), 900, 8, 8, 7
from public.courses c where c.code = 'DEMO-FIN';

\echo '== 10. get_weak_topics =='
select topic, mastery, cards_total, cards_struggling, cards_never_reviewed
from public.get_weak_topics(null, 10);

\echo '== 11. get_exam_readiness =='
select jsonb_pretty(public.get_exam_readiness((select id from public.exams limit 1)));

\echo '== 12. build_exam_session =='
select question, reason, priority
from public.build_exam_session((select id from public.exams limit 1), 10);

\echo '== 13. Quiz de bout en bout =='
do $$
declare
  v_quiz uuid; v_q1 uuid; v_q2 uuid; v_attempt uuid; v_course uuid; v_section uuid;
begin
  select id into v_course from public.courses where code = 'DEMO-FIN';
  select id into v_section from public.course_sections where course_id = v_course and position = 2;

  insert into public.quizzes (user_id, course_id, section_id, title, difficulty, created_by)
  values (auth.uid(), v_course, v_section, 'Quiz obligations', 'medium', 'claude') returning id into v_quiz;

  insert into public.quiz_questions (quiz_id, position, question, question_type, choices, correct_answer, explanation, topic)
  values (v_quiz, 0, 'Le prix d''une obligation baisse quand les taux montent.', 'true_false',
          '["Vrai","Faux"]'::jsonb, 'Vrai', 'Relation inverse prix/taux.', 'Obligations')
  returning id into v_q1;
  insert into public.quiz_questions (quiz_id, position, question, question_type, choices, correct_answer, topic)
  values (v_quiz, 1, 'Que mesure la duration ?', 'multiple_choice',
          '["La sensibilité aux taux","Le coupon","Le nominal","La notation"]'::jsonb,
          'La sensibilité aux taux', 'Obligations')
  returning id into v_q2;

  insert into public.quiz_attempts (user_id, quiz_id, total_questions) values (auth.uid(), v_quiz, 2)
  returning id into v_attempt;
  insert into public.quiz_answers (attempt_id, question_id, user_answer, is_correct)
  values (v_attempt, v_q1, 'Vrai', true), (v_attempt, v_q2, 'Le coupon', false);
  update public.quiz_attempts set score = 1, completed_at = now() where id = v_attempt;
  raise notice 'Quiz créé et tentative enregistrée.';
end;
$$;

select topic, mastery, quiz_answered, quiz_correct from public.get_weak_topics(null, 10);

\echo '== 14. get_progress_overview =='
select jsonb_pretty(public.get_progress_overview(7));

\echo '== 15. global_search =='
select kind, title from public.global_search('oblig', 20);

\echo '== 16. refresh_notifications (idempotent) =='
select public.refresh_notifications() as created_first_call;
select public.refresh_notifications() as created_second_call;
select type, title from public.notifications order by created_at;

\echo '== 17. Bob ne voit toujours rien d''Alice =='
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select
  (select count(*) from public.flashcards where course_id in (select id from public.courses where code='DEMO-FIN')) as leaked_cards,
  (select count(*) from public.get_due_flashcards(null,null,50,true)) as bob_due,
  (select count(*) from public.get_weak_topics(null,10))             as bob_weak,
  (select count(*) from public.global_search('oblig', 20))           as bob_search,
  (select count(*) from public.quiz_questions)                       as bob_quiz_questions,
  (select count(*) from public.quiz_answers)                         as bob_quiz_answers,
  (select count(*) from public.notifications)                        as bob_notifications;

\echo '== 18. ON DELETE CASCADE =='
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select public.remove_demo_data() ->> 'deleted' as deleted_courses;
select
  (select count(*) from public.course_sections) as sections_left,
  (select count(*) from public.flashcards)      as cards_left,
  (select count(*) from public.exams)           as exams_left,
  (select count(*) from public.quizzes)         as quizzes_left,
  (select count(*) from public.quiz_questions)  as questions_left,
  (select count(*) from public.flashcard_progress) as progress_left;

reset role;
\echo '== 19. RLS activée partout ? =='
select tablename, rowsecurity, relforcerowsecurity
from pg_tables t join pg_class c on c.relname = t.tablename
where schemaname = 'public' and (not rowsecurity or not relforcerowsecurity);

\echo '== 20. Tables sans politique ? =='
select c.relname
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
  and not exists (select 1 from pg_policy p where p.polrelid = c.oid);
