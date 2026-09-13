-- =====================================================================
-- Revia — données de démonstration
-- Volontairement minimales : un cours, 4 chapitres, un peu de contenu.
-- L'utilisateur peut les créer puis les supprimer d'un clic (/settings).
-- =====================================================================

create or replace function public.seed_demo_data()
returns jsonb
language plpgsql
volatile
security invoker
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := (select auth.uid());
  v_course uuid;
  v_s1 uuid; v_s2 uuid; v_s3 uuid; v_s4 uuid;
  v_exam uuid;
begin
  if v_uid is null then
    raise exception 'Non authentifié' using errcode = '42501';
  end if;

  if exists (select 1 from public.courses where user_id = v_uid and code = 'DEMO-FIN') then
    return jsonb_build_object('created', false, 'reason', 'already_exists');
  end if;

  insert into public.courses (user_id, name, code, professor, institution, semester,
                              description, color, icon, start_date, end_date)
  values (v_uid, 'Finance (démo)', 'DEMO-FIN', 'Prof. Exemple', 'Université',
          'Automne', 'Cours de démonstration — supprimable à tout moment depuis les paramètres.',
          '#4f46e5', 'trending-up', current_date - 30, current_date + 60)
  returning id into v_course;

  insert into public.course_sections (course_id, user_id, title, description, position)
  values (v_course, v_uid, 'Chapitre 1 — Introduction', 'Rôle de la finance, marchés, acteurs.', 0)
  returning id into v_s1;
  insert into public.course_sections (course_id, user_id, title, description, position)
  values (v_course, v_uid, 'Chapitre 2 — Valeur temporelle de l''argent', 'Actualisation, capitalisation, annuités.', 1)
  returning id into v_s2;
  insert into public.course_sections (course_id, user_id, title, description, position)
  values (v_course, v_uid, 'Chapitre 3 — Obligations', 'Prix, coupon, duration, courbe des taux.', 2)
  returning id into v_s3;
  insert into public.course_sections (course_id, user_id, title, description, position)
  values (v_course, v_uid, 'Chapitre 4 — Actions', 'Valorisation, dividendes, modèle de Gordon.', 3)
  returning id into v_s4;

  insert into public.study_materials (user_id, course_id, section_id, title, type, raw_content, source)
  values (
    v_uid, v_course, v_s2, 'Notes de cours — valeur temporelle', 'notes',
    'La valeur temporelle de l''argent repose sur le principe qu''un euro reçu aujourd''hui vaut '
    || 'plus qu''un euro reçu demain, car il peut être investi. '
    || 'Valeur future : VF = VP × (1 + r)^n. '
    || 'Valeur présente : VP = VF / (1 + r)^n. '
    || 'Une annuité constante de montant C sur n périodes au taux r vaut '
    || 'VP = C × (1 - (1 + r)^-n) / r. '
    || 'Une perpétuité vaut VP = C / r.',
    'Notes personnelles'
  );

  insert into public.flashcards (user_id, course_id, section_id, question, answer, explanation, difficulty, topic, created_by)
  values
    (v_uid, v_course, v_s2, 'Quelle est la formule de la valeur présente ?',
     'VP = VF / (1 + r)^n',
     'On actualise le flux futur au taux r sur n périodes.', 'easy', 'Valeur temporelle', 'manual'),
    (v_uid, v_course, v_s2, 'Comment valorise-t-on une perpétuité constante ?',
     'VP = C / r',
     'Somme d''une suite géométrique infinie de raison 1/(1+r).', 'medium', 'Valeur temporelle', 'manual'),
    (v_uid, v_course, v_s3, 'Que mesure la duration d''une obligation ?',
     'La sensibilité du prix aux variations de taux d''intérêt.',
     'C''est aussi la maturité moyenne pondérée des flux actualisés.', 'medium', 'Obligations', 'manual'),
    (v_uid, v_course, v_s3, 'Comment évolue le prix d''une obligation si les taux montent ?',
     'Le prix baisse.',
     'Relation inverse entre prix et taux : les flux futurs sont actualisés plus fortement.', 'easy', 'Obligations', 'manual'),
    (v_uid, v_course, v_s4, 'Énoncez le modèle de Gordon-Shapiro.',
     'P0 = D1 / (k - g)',
     'Valorisation d''une action dont le dividende croît au taux constant g, avec k > g.', 'hard', 'Actions', 'manual');

  insert into public.exams (user_id, course_id, title, exam_type, exam_date, start_time, location, description, weight_percentage)
  values (v_uid, v_course, 'Examen de mi-session', 'midterm', current_date + 14,
          '09:00', 'Salle A-201', 'Chapitres 1 à 3.', 30)
  returning id into v_exam;

  insert into public.exam_sections (exam_id, section_id)
  values (v_exam, v_s1), (v_exam, v_s2), (v_exam, v_s3);

  return jsonb_build_object('created', true, 'course_id', v_course);
end;
$$;

create or replace function public.remove_demo_data()
returns jsonb
language plpgsql
volatile
security invoker
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := (select auth.uid());
  v_deleted int;
begin
  if v_uid is null then
    raise exception 'Non authentifié' using errcode = '42501';
  end if;

  with removed as (
    delete from public.courses
    where user_id = v_uid and code = 'DEMO-FIN'
    returning 1
  )
  select count(*) into v_deleted from removed;

  return jsonb_build_object('deleted', v_deleted);
end;
$$;

grant execute on function public.seed_demo_data() to authenticated;
grant execute on function public.remove_demo_data() to authenticated;
