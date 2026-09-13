\set ON_ERROR_STOP on
set role authenticated;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select public.seed_demo_data() ->> 'created' as alice_demo;

select id as alice_course from public.courses where code = 'DEMO-FIN' \gset
select id as alice_section from public.course_sections where course_id = :'alice_course' limit 1 \gset
select id as alice_exam from public.exams where course_id = :'alice_course' limit 1 \gset
select id as alice_card from public.flashcards where course_id = :'alice_course' limit 1 \gset

-- Les UUID d'Alice sont passés en GUC pour être lisibles dans les blocs DO.
set app.alice_course = :'alice_course';
set app.alice_section = :'alice_section';
set app.alice_exam = :'alice_exam';
set app.alice_card = :'alice_card';

\echo '== Bob connaît les UUID d''Alice et tente de les réutiliser =='
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

do $$
declare v_course uuid := current_setting('app.alice_course')::uuid;
begin
  insert into public.flashcards (user_id, course_id, question, answer)
  values (auth.uid(), v_course, 'vol', 'vol');
  raise exception 'FAILLE 1 : carte insérée sur le cours d''Alice';
exception when insufficient_privilege then raise notice '1. flashcard vers cours d''Alice -> REFUSÉ';
end $$;

do $$
declare v_course uuid := current_setting('app.alice_course')::uuid;
begin
  insert into public.course_sections (user_id, course_id, title) values (auth.uid(), v_course, 'vol');
  raise exception 'FAILLE 2 : chapitre inséré';
exception when insufficient_privilege then raise notice '2. chapitre vers cours d''Alice -> REFUSÉ';
end $$;

do $$
declare v_section uuid := current_setting('app.alice_section')::uuid; v_course uuid;
begin
  insert into public.courses (user_id, name, code) values (auth.uid(), 'Cours de Bob', 'BOB-9')
  returning id into v_course;
  insert into public.study_materials (user_id, course_id, section_id, title, type)
  values (auth.uid(), v_course, v_section, 'vol', 'text');
  raise exception 'FAILLE 3 : contenu rattaché au chapitre d''Alice';
exception when insufficient_privilege then raise notice '3. contenu vers chapitre d''Alice -> REFUSÉ';
end $$;

do $$
declare v_card uuid := current_setting('app.alice_card')::uuid;
begin
  insert into public.flashcard_progress (user_id, flashcard_id) values (auth.uid(), v_card);
  raise exception 'FAILLE 4 : progression créée sur la carte d''Alice';
exception when insufficient_privilege then raise notice '4. progression sur carte d''Alice -> REFUSÉ';
end $$;

do $$
declare v_exam uuid := current_setting('app.alice_exam')::uuid;
        v_section uuid := current_setting('app.alice_section')::uuid;
begin
  insert into public.exam_sections (exam_id, section_id) values (v_exam, v_section);
  raise exception 'FAILLE 5 : exam_sections inséré';
exception when insufficient_privilege then raise notice '5. exam_sections vers examen d''Alice -> REFUSÉ';
end $$;

do $$
begin
  insert into public.user_roles (user_id, role) values (auth.uid(), 'admin');
  raise exception 'FAILLE 6 : auto-attribution de rôle';
exception when insufficient_privilege then raise notice '6. auto-attribution du rôle admin -> REFUSÉ';
end $$;

do $$
declare v_exam uuid := current_setting('app.alice_exam')::uuid; v_result jsonb;
begin
  v_result := public.get_exam_readiness(v_exam);
  raise notice '7. get_exam_readiness sur l''examen d''Alice -> %', v_result ->> 'error';
end $$;

do $$
declare v_exam uuid := current_setting('app.alice_exam')::uuid; v_count int;
begin
  select count(*) into v_count from public.build_exam_session(v_exam, 20);
  raise notice '8. build_exam_session sur l''examen d''Alice -> % carte(s)', v_count;
end $$;

select count(*) as "9. profil d'Alice visible par Bob"
from public.profiles where id = '11111111-1111-1111-1111-111111111111';

with updated as (update public.courses set name = 'pirate' where id = current_setting('app.alice_course')::uuid returning 1)
select count(*) as "10. lignes modifiées par Bob" from updated;

with removed as (delete from public.courses where id = current_setting('app.alice_course')::uuid returning 1)
select count(*) as "11. lignes supprimées par Bob" from removed;

reset role;
select name as "12. cours d'Alice intact" from public.courses where code = 'DEMO-FIN';
