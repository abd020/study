-- =====================================================================
-- Revia — logique métier côté base de données
-- Toutes ces fonctions sont SECURITY INVOKER : la RLS s'applique donc
-- normalement et un utilisateur ne peut jamais lire les données d'un autre.
-- Aucune de ces fonctions n'appelle Claude.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Vue de synthèse par cours (cards du dashboard et page /courses)
-- ---------------------------------------------------------------------
create or replace view public.course_overview
with (security_invoker = true) as
select
  c.id,
  c.user_id,
  c.name,
  c.code,
  c.professor,
  c.institution,
  c.semester,
  c.description,
  c.color,
  c.icon,
  c.start_date,
  c.end_date,
  c.archived,
  c.created_at,
  c.updated_at,
  coalesce(sec.section_count, 0)::int as section_count,
  coalesce(mat.material_count, 0)::int as material_count,
  coalesce(cards.total, 0)::int as flashcard_count,
  coalesce(cards.mastered, 0)::int as mastered_count,
  coalesce(cards.due, 0)::int as due_count,
  coalesce(cards.untouched, 0)::int as new_count,
  cards.last_reviewed_at,
  case
    when coalesce(cards.total, 0) = 0 then 0
    else greatest(0, least(100, round(
      (cards.mastered * 1.0 + cards.in_review * 0.6 + cards.learning * 0.25) * 100.0
      / nullif(cards.total, 0)
    )::int))
  end as progress,
  quiz.avg_score::int,
  ex.next_exam_id,
  ex.next_exam_title,
  ex.next_exam_date
from public.courses c
left join lateral (
  select count(*) as section_count
  from public.course_sections s
  where s.course_id = c.id
) sec on true
left join lateral (
  select count(*) as material_count
  from public.study_materials m
  where m.course_id = c.id
) mat on true
left join lateral (
  select
    count(*) as total,
    count(*) filter (where fp.status = 'mastered') as mastered,
    count(*) filter (where fp.status = 'review') as in_review,
    count(*) filter (where fp.status in ('learning', 'lapsed')) as learning,
    count(*) filter (where fp.id is null) as untouched,
    count(*) filter (where fp.id is null or fp.next_review_at <= now()) as due,
    max(fp.last_reviewed_at) as last_reviewed_at
  from public.flashcards f
  left join public.flashcard_progress fp
    on fp.flashcard_id = f.id and fp.user_id = c.user_id
  where f.course_id = c.id and not f.archived
) cards on true
left join lateral (
  select round(avg(a.score * 100.0 / nullif(a.total_questions, 0))) as avg_score
  from public.quiz_attempts a
  join public.quizzes q on q.id = a.quiz_id
  where q.course_id = c.id and a.completed_at is not null
) quiz on true
left join lateral (
  select e.id as next_exam_id, e.title as next_exam_title, e.exam_date as next_exam_date
  from public.exams e
  where e.course_id = c.id and e.exam_date >= current_date
  order by e.exam_date asc
  limit 1
) ex on true;

-- ---------------------------------------------------------------------
-- Cartes à réviser aujourd'hui (moteur de répétition espacée, sans IA)
-- ---------------------------------------------------------------------
create or replace function public.get_due_flashcards(
  p_course_id uuid default null,
  p_section_ids uuid[] default null,
  p_limit int default 50,
  p_include_new boolean default true
)
returns table (
  id uuid,
  course_id uuid,
  section_id uuid,
  course_name text,
  course_color text,
  section_title text,
  question text,
  answer text,
  explanation text,
  difficulty public.difficulty_level,
  topic text,
  repetitions int,
  ease_factor numeric,
  interval_days numeric,
  next_review_at timestamptz,
  status public.card_status,
  progress_id uuid
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select
    f.id, f.course_id, f.section_id, c.name, c.color, s.title,
    f.question, f.answer, f.explanation, f.difficulty, f.topic,
    coalesce(fp.repetitions, 0), coalesce(fp.ease_factor, 2.50),
    coalesce(fp.interval_days, 0),
    coalesce(fp.next_review_at, now()), coalesce(fp.status, 'new'::public.card_status),
    fp.id
  from public.flashcards f
  join public.courses c on c.id = f.course_id
  left join public.course_sections s on s.id = f.section_id
  left join public.flashcard_progress fp
    on fp.flashcard_id = f.id and fp.user_id = f.user_id
  where f.user_id = (select auth.uid())
    and not f.archived
    and (p_course_id is null or f.course_id = p_course_id)
    and (p_section_ids is null or f.section_id = any (p_section_ids))
    and (
      (fp.id is null and p_include_new)
      or fp.next_review_at <= now()
    )
  order by
    case when fp.id is null then 1 else 0 end,
    fp.next_review_at asc nulls last,
    f.created_at asc
  limit greatest(1, least(coalesce(p_limit, 50), 500));
$$;

-- ---------------------------------------------------------------------
-- Moteur de détection des points faibles
-- Croise : cartes en difficulté, réponses de quiz, fréquence de révision.
-- ---------------------------------------------------------------------
create or replace function public.get_weak_topics(
  p_course_id uuid default null,
  p_limit int default 12
)
returns table (
  topic text,
  course_id uuid,
  course_name text,
  course_color text,
  mastery int,
  cards_total int,
  cards_struggling int,
  cards_never_reviewed int,
  quiz_answered int,
  quiz_correct int,
  last_reviewed_at timestamptz
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with me as (select (select auth.uid()) as uid),
  card_stats as (
    select
      f.topic,
      f.course_id,
      count(*)::int as cards_total,
      count(*) filter (where fp.status in ('learning', 'lapsed'))::int as cards_struggling,
      count(*) filter (where fp.id is null)::int as cards_never_reviewed,
      coalesce(sum(fp.correct_count), 0)::int as correct,
      coalesce(sum(fp.incorrect_count), 0)::int as incorrect,
      max(fp.last_reviewed_at) as last_reviewed_at
    from public.flashcards f
    cross join me
    left join public.flashcard_progress fp
      on fp.flashcard_id = f.id and fp.user_id = me.uid
    where f.user_id = me.uid
      and not f.archived
      and f.topic is not null and btrim(f.topic) <> ''
      and (p_course_id is null or f.course_id = p_course_id)
    group by f.topic, f.course_id
  ),
  quiz_stats as (
    select
      qq.topic,
      q.course_id,
      count(*)::int as quiz_answered,
      count(*) filter (where qa.is_correct)::int as quiz_correct
    from public.quiz_answers qa
    cross join me
    join public.quiz_attempts qat on qat.id = qa.attempt_id
    join public.quiz_questions qq on qq.id = qa.question_id
    join public.quizzes q on q.id = qat.quiz_id
    where qat.user_id = me.uid
      and qq.topic is not null and btrim(qq.topic) <> ''
      and (p_course_id is null or q.course_id = p_course_id)
    group by qq.topic, q.course_id
  ),
  merged as (
    select
      coalesce(cs.topic, qs.topic) as topic,
      coalesce(cs.course_id, qs.course_id) as course_id,
      coalesce(cs.cards_total, 0) as cards_total,
      coalesce(cs.cards_struggling, 0) as cards_struggling,
      coalesce(cs.cards_never_reviewed, 0) as cards_never_reviewed,
      coalesce(cs.correct, 0) as correct,
      coalesce(cs.incorrect, 0) as incorrect,
      coalesce(qs.quiz_answered, 0) as quiz_answered,
      coalesce(qs.quiz_correct, 0) as quiz_correct,
      cs.last_reviewed_at
    from card_stats cs
    full outer join quiz_stats qs
      on qs.topic = cs.topic and qs.course_id = cs.course_id
  ),
  scored as (
    select
      m.*,
      -- Performance : moyenne pondérée des réponses de cartes et de quiz.
      case
        when (m.correct + m.incorrect + m.quiz_answered) = 0 then 0::numeric
        else (m.correct + m.quiz_correct)::numeric
             / nullif(m.correct + m.incorrect + m.quiz_answered, 0)
      end as performance,
      -- Couverture : part des cartes déjà vues au moins une fois.
      case
        when m.cards_total = 0 then 1::numeric
        else (m.cards_total - m.cards_never_reviewed)::numeric / m.cards_total
      end as coverage
    from merged m
  )
  select
    s.topic,
    s.course_id,
    c.name,
    c.color,
    greatest(0, least(100, round(100 * s.performance * (0.45 + 0.55 * s.coverage))::int)) as mastery,
    s.cards_total,
    s.cards_struggling,
    s.cards_never_reviewed,
    s.quiz_answered,
    s.quiz_correct,
    s.last_reviewed_at
  from scored s
  join public.courses c on c.id = s.course_id
  where s.cards_total + s.quiz_answered > 0
  order by mastery asc, s.cards_struggling desc, s.cards_total desc
  limit greatest(1, least(coalesce(p_limit, 12), 100));
$$;

-- ---------------------------------------------------------------------
-- Niveau de préparation d'un examen
-- ---------------------------------------------------------------------
create or replace function public.get_exam_readiness(p_exam_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public, pg_temp
as $$
declare
  v_exam public.exams%rowtype;
  v_section_ids uuid[];
  v_cards_total int := 0;
  v_cards_mastered int := 0;
  v_cards_review int := 0;
  v_cards_learning int := 0;
  v_cards_new int := 0;
  v_quiz_score numeric;
  v_weak_count int := 0;
  v_sections_total int := 0;
  v_sections_covered int := 0;
  v_card_score numeric := 0;
  v_coverage numeric := 0;
  v_readiness int := 0;
  v_days int;
begin
  select * into v_exam from public.exams where id = p_exam_id;
  if not found then
    return jsonb_build_object('error', 'not_found');
  end if;

  select array_agg(section_id) into v_section_ids
  from public.exam_sections where exam_id = p_exam_id;

  -- Sans chapitres explicites, l'examen porte sur tout le cours.
  if v_section_ids is null then
    select array_agg(id) into v_section_ids
    from public.course_sections where course_id = v_exam.course_id;
  end if;

  select
    count(*), count(*) filter (where fp.status = 'mastered'),
    count(*) filter (where fp.status = 'review'),
    count(*) filter (where fp.status in ('learning', 'lapsed')),
    count(*) filter (where fp.id is null)
  into v_cards_total, v_cards_mastered, v_cards_review, v_cards_learning, v_cards_new
  from public.flashcards f
  left join public.flashcard_progress fp
    on fp.flashcard_id = f.id and fp.user_id = f.user_id
  where f.course_id = v_exam.course_id
    and not f.archived
    and (v_section_ids is null or f.section_id is null or f.section_id = any (v_section_ids));

  select round(avg(a.score * 100.0 / nullif(a.total_questions, 0)))
  into v_quiz_score
  from public.quiz_attempts a
  join public.quizzes q on q.id = a.quiz_id
  where q.course_id = v_exam.course_id
    and a.completed_at is not null
    and (v_section_ids is null or q.section_id is null or q.section_id = any (v_section_ids));

  select count(*) into v_weak_count
  from public.get_weak_topics(v_exam.course_id, 100) w
  where w.mastery < 50;

  select count(*) into v_sections_total
  from public.course_sections s
  where s.course_id = v_exam.course_id
    and (v_section_ids is null or s.id = any (v_section_ids));

  select count(distinct s.id) into v_sections_covered
  from public.course_sections s
  where s.course_id = v_exam.course_id
    and (v_section_ids is null or s.id = any (v_section_ids))
    and (
      exists (select 1 from public.flashcards f where f.section_id = s.id and not f.archived)
      or exists (select 1 from public.study_summaries su where su.section_id = s.id)
    );

  if v_cards_total > 0 then
    v_card_score := (v_cards_mastered * 1.0 + v_cards_review * 0.6 + v_cards_learning * 0.25)
                    / v_cards_total;
  end if;

  if v_sections_total > 0 then
    v_coverage := v_sections_covered::numeric / v_sections_total;
  elsif v_cards_total > 0 then
    v_coverage := 1;
  end if;

  -- 55 % maîtrise des cartes, 25 % résultats de quiz, 20 % couverture du
  -- programme ; pénalité pour chaque notion faible identifiée.
  v_readiness := greatest(0, least(100, round(
      v_card_score * 55
    + coalesce(v_quiz_score, v_card_score * 100) / 100 * 25
    + v_coverage * 20
    - least(10, v_weak_count * 2)
  )::int));

  v_days := (v_exam.exam_date - current_date);

  return jsonb_build_object(
    'exam_id', v_exam.id,
    'readiness', v_readiness,
    'days_remaining', v_days,
    'cards_total', v_cards_total,
    'cards_mastered', v_cards_mastered,
    'cards_review', v_cards_review,
    'cards_learning', v_cards_learning,
    'cards_new', v_cards_new,
    'quiz_score', v_quiz_score,
    'weak_topics', v_weak_count,
    'sections_total', v_sections_total,
    'sections_covered', v_sections_covered,
    'recommended_daily_cards',
      case when v_days is null or v_days <= 0 then v_cards_total
           else ceil((v_cards_new + v_cards_learning)::numeric / greatest(v_days, 1))::int end
  );
end;
$$;

-- ---------------------------------------------------------------------
-- Session « Révision avant examen » : mélange priorisé de cartes
-- ---------------------------------------------------------------------
create or replace function public.build_exam_session(
  p_exam_id uuid,
  p_limit int default 30
)
returns table (
  id uuid,
  course_id uuid,
  section_id uuid,
  course_name text,
  course_color text,
  section_title text,
  question text,
  answer text,
  explanation text,
  difficulty public.difficulty_level,
  topic text,
  status public.card_status,
  reason text,
  priority int
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with exam as (
    select e.* from public.exams e where e.id = p_exam_id
  ),
  target_sections as (
    select coalesce(
      (select array_agg(es.section_id) from public.exam_sections es where es.exam_id = p_exam_id),
      (select array_agg(s.id) from public.course_sections s
        join exam on s.course_id = exam.course_id)
    ) as ids
  ),
  weak as (
    select w.topic from public.get_weak_topics((select course_id from exam), 100) w
    where w.mastery < 60
  ),
  wrong_topics as (
    select distinct qq.topic
    from public.quiz_answers qa
    join public.quiz_attempts qat on qat.id = qa.attempt_id
    join public.quiz_questions qq on qq.id = qa.question_id
    join public.quizzes q on q.id = qat.quiz_id
    where q.course_id = (select course_id from exam)
      and not qa.is_correct
      and qq.topic is not null
  )
  select
    f.id, f.course_id, f.section_id, c.name, c.color, s.title,
    f.question, f.answer, f.explanation, f.difficulty, f.topic,
    coalesce(fp.status, 'new'::public.card_status),
    case
      when fp.status in ('learning', 'lapsed') then 'Carte difficile'
      when fp.id is null then 'Jamais révisée'
      when f.topic in (select topic from wrong_topics) then 'Erreur de quiz'
      when f.topic in (select topic from weak) then 'Notion faible'
      when fp.next_review_at <= now() then 'À réviser'
      else 'Consolidation'
    end as reason,
    case
      when fp.status in ('learning', 'lapsed') then 1
      when fp.id is null then 2
      when f.topic in (select topic from wrong_topics) then 3
      when f.topic in (select topic from weak) then 4
      when fp.next_review_at <= now() then 5
      else 6
    end as priority
  from public.flashcards f
  join exam on exam.course_id = f.course_id
  cross join target_sections ts
  join public.courses c on c.id = f.course_id
  left join public.course_sections s on s.id = f.section_id
  left join public.flashcard_progress fp
    on fp.flashcard_id = f.id and fp.user_id = f.user_id
  where not f.archived
    and (
      ts.ids is null
      or f.section_id is null
      or f.section_id = any (ts.ids)
    )
  order by priority asc, fp.next_review_at asc nulls first, random()
  limit greatest(1, least(coalesce(p_limit, 30), 200));
$$;

-- ---------------------------------------------------------------------
-- Synthèse du dashboard (une seule requête, zéro appel IA)
-- ---------------------------------------------------------------------
create or replace function public.get_dashboard_summary()
returns jsonb
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with me as (select (select auth.uid()) as uid),
  due as (
    select
      count(*)::int as due_today,
      count(*) filter (where fp.id is null)::int as new_today
    from public.flashcards f
    cross join me
    left join public.flashcard_progress fp on fp.flashcard_id = f.id and fp.user_id = me.uid
    where f.user_id = me.uid and not f.archived
      and (fp.id is null or fp.next_review_at <= now())
  ),
  cards as (
    select
      count(*)::int as total,
      count(*) filter (where fp.status = 'mastered')::int as mastered,
      count(*) filter (where fp.status = 'review')::int as in_review,
      count(*) filter (where fp.status in ('learning', 'lapsed'))::int as learning
    from public.flashcards f
    cross join me
    left join public.flashcard_progress fp on fp.flashcard_id = f.id and fp.user_id = me.uid
    where f.user_id = me.uid and not f.archived
  ),
  week as (
    select
      coalesce(sum(ss.duration_seconds), 0)::int as seconds_this_week,
      count(*)::int as sessions_this_week,
      coalesce(sum(ss.cards_reviewed), 0)::int as cards_this_week
    from public.study_sessions ss
    cross join me
    where ss.user_id = me.uid
      and ss.started_at >= date_trunc('week', now())
  ),
  today as (
    select coalesce(sum(ss.duration_seconds), 0)::int as seconds_today,
           coalesce(sum(ss.cards_reviewed), 0)::int as cards_today
    from public.study_sessions ss
    cross join me
    where ss.user_id = me.uid and ss.started_at >= date_trunc('day', now())
  ),
  next_exam as (
    select to_jsonb(x) as data
    from (
      select e.id, e.title, e.exam_date, e.exam_type, e.start_time, e.location,
             c.name as course_name, c.color as course_color, c.id as course_id,
             (e.exam_date - current_date) as days_remaining
      from public.exams e
      cross join me
      join public.courses c on c.id = e.course_id
      where e.user_id = me.uid and e.exam_date >= current_date
      order by e.exam_date asc
      limit 1
    ) x
  ),
  streak as (
    select count(*)::int as days
    from (
      select d.day, row_number() over (order by d.day desc) as rn
      from (
        select distinct date_trunc('day', ss.started_at)::date as day
        from public.study_sessions ss
        cross join me
        where ss.user_id = me.uid and ss.duration_seconds > 0
      ) d
      where d.day <= current_date
    ) t
    where t.day = current_date - ((t.rn - 1))::int
  )
  select jsonb_build_object(
    'due_today', (select due_today from due),
    'new_today', (select new_today from due),
    'cards_total', (select total from cards),
    'cards_mastered', (select mastered from cards),
    'cards_review', (select in_review from cards),
    'cards_learning', (select learning from cards),
    'global_progress', (
      select case when total = 0 then 0
        else greatest(0, least(100, round((mastered * 1.0 + in_review * 0.6 + learning * 0.25) * 100.0 / total)::int))
      end from cards
    ),
    'seconds_this_week', (select seconds_this_week from week),
    'sessions_this_week', (select sessions_this_week from week),
    'cards_this_week', (select cards_this_week from week),
    'seconds_today', (select seconds_today from today),
    'cards_today', (select cards_today from today),
    'streak_days', coalesce((select days from streak), 0),
    'next_exam', (select data from next_exam)
  );
$$;

-- ---------------------------------------------------------------------
-- Statistiques de progression (/progress)
-- ---------------------------------------------------------------------
create or replace function public.get_progress_overview(p_days int default 30)
returns jsonb
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with me as (select (select auth.uid()) as uid),
  span as (select generate_series(current_date - (greatest(coalesce(p_days, 30), 1) - 1), current_date, '1 day')::date as day),
  daily as (
    select
      sp.day,
      coalesce(sum(ss.duration_seconds), 0)::int as seconds,
      coalesce(sum(ss.cards_reviewed), 0)::int as cards,
      coalesce(sum(ss.questions_answered), 0)::int as questions,
      coalesce(sum(ss.correct_answers), 0)::int as correct
    from span sp
    cross join me
    left join public.study_sessions ss
      on ss.user_id = me.uid and date_trunc('day', ss.started_at)::date = sp.day
    group by sp.day
    order by sp.day
  ),
  totals as (
    select
      coalesce(sum(ss.duration_seconds), 0)::int as total_seconds,
      count(*)::int as total_sessions,
      coalesce(sum(ss.cards_reviewed), 0)::int as total_cards,
      coalesce(sum(ss.questions_answered), 0)::int as total_questions,
      coalesce(sum(ss.correct_answers), 0)::int as total_correct
    from public.study_sessions ss
    cross join me
    where ss.user_id = me.uid
  ),
  quiz as (
    select round(avg(a.score * 100.0 / nullif(a.total_questions, 0)))::int as avg_score,
           count(*)::int as attempts
    from public.quiz_attempts a
    cross join me
    where a.user_id = me.uid and a.completed_at is not null
  ),
  per_course as (
    select coalesce(jsonb_agg(to_jsonb(x) order by x.progress desc), '[]'::jsonb) as data
    from (
      select co.id, co.name, co.color, co.progress, co.flashcard_count,
             co.mastered_count, co.due_count, co.avg_score
      from public.course_overview co
      cross join me
      where co.user_id = me.uid and not co.archived
    ) x
  ),
  per_section as (
    select coalesce(jsonb_agg(to_jsonb(x) order by x.mastery asc), '[]'::jsonb) as data
    from (
      select
        s.id, s.title, s.course_id, c.name as course_name, c.color as course_color,
        count(f.id)::int as cards_total,
        count(f.id) filter (where fp.status = 'mastered')::int as cards_mastered,
        case when count(f.id) = 0 then 0
          else round(
            (count(f.id) filter (where fp.status = 'mastered') * 1.0
             + count(f.id) filter (where fp.status = 'review') * 0.6
             + count(f.id) filter (where fp.status in ('learning', 'lapsed')) * 0.25)
            * 100.0 / count(f.id))::int
        end as mastery
      from public.course_sections s
      cross join me
      join public.courses c on c.id = s.course_id
      left join public.flashcards f on f.section_id = s.id and not f.archived
      left join public.flashcard_progress fp on fp.flashcard_id = f.id and fp.user_id = me.uid
      where s.user_id = me.uid
      group by s.id, s.title, s.course_id, c.name, c.color
    ) x
  ),
  cards as (
    select
      count(*)::int as total,
      count(*) filter (where fp.id is not null)::int as studied,
      count(*) filter (where fp.status = 'mastered')::int as mastered
    from public.flashcards f
    cross join me
    left join public.flashcard_progress fp on fp.flashcard_id = f.id and fp.user_id = me.uid
    where f.user_id = me.uid and not f.archived
  )
  select jsonb_build_object(
    'daily', (select coalesce(jsonb_agg(to_jsonb(d) order by d.day), '[]'::jsonb) from daily d),
    'total_seconds', (select total_seconds from totals),
    'total_sessions', (select total_sessions from totals),
    'total_cards_reviewed', (select total_cards from totals),
    'total_questions', (select total_questions from totals),
    'total_correct', (select total_correct from totals),
    'cards_total', (select total from cards),
    'cards_studied', (select studied from cards),
    'cards_mastered', (select mastered from cards),
    'quiz_avg_score', (select avg_score from quiz),
    'quiz_attempts', (select attempts from quiz),
    'by_course', (select data from per_course),
    'by_section', (select data from per_section)
  );
$$;

-- ---------------------------------------------------------------------
-- Recherche globale
-- ---------------------------------------------------------------------
create or replace function public.global_search(p_query text, p_limit int default 30)
returns table (
  kind text,
  id uuid,
  title text,
  subtitle text,
  course_id uuid,
  course_name text,
  course_color text,
  section_id uuid
)
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  with q as (select '%' || btrim(coalesce(p_query, '')) || '%' as pattern)
  select * from (
    select 'course'::text, c.id, c.name,
           coalesce(c.code, c.semester, c.professor), c.id, c.name, c.color, null::uuid
    from public.courses c, q
    where c.name ilike q.pattern or coalesce(c.code, '') ilike q.pattern
       or coalesce(c.professor, '') ilike q.pattern

    union all
    select 'section', s.id, s.title, c.name, c.id, c.name, c.color, s.id
    from public.course_sections s join public.courses c on c.id = s.course_id, q
    where s.title ilike q.pattern or coalesce(s.description, '') ilike q.pattern

    union all
    select 'flashcard', f.id, f.question, coalesce(f.topic, c.name), c.id, c.name, c.color, f.section_id
    from public.flashcards f join public.courses c on c.id = f.course_id, q
    where f.question ilike q.pattern or f.answer ilike q.pattern
       or coalesce(f.topic, '') ilike q.pattern

    union all
    select 'summary', su.id, su.title, c.name, c.id, c.name, c.color, su.section_id
    from public.study_summaries su join public.courses c on c.id = su.course_id, q
    where su.title ilike q.pattern or su.content::text ilike q.pattern

    union all
    select 'material', m.id, m.title, c.name, c.id, c.name, c.color, m.section_id
    from public.study_materials m join public.courses c on c.id = m.course_id, q
    where m.title ilike q.pattern or coalesce(m.raw_content, '') ilike q.pattern

    union all
    select 'exam', e.id, e.title, c.name || ' · ' || to_char(e.exam_date, 'DD/MM/YYYY'),
           c.id, c.name, c.color, null::uuid
    from public.exams e join public.courses c on c.id = e.course_id, q
    where e.title ilike q.pattern or coalesce(e.description, '') ilike q.pattern

    union all
    select 'quiz', z.id, z.title, c.name, c.id, c.name, c.color, z.section_id
    from public.quizzes z join public.courses c on c.id = z.course_id, q
    where z.title ilike q.pattern
  ) results
  limit greatest(1, least(coalesce(p_limit, 30), 100));
$$;

-- ---------------------------------------------------------------------
-- Notifications internes : générées par la base, sans IA.
-- Idempotent grâce à dedupe_key.
-- ---------------------------------------------------------------------
create or replace function public.refresh_notifications()
returns int
language plpgsql
volatile
security invoker
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := (select auth.uid());
  v_created int := 0;
  v_days_before int := 7;
  v_due int := 0;
  r record;
begin
  if v_uid is null then
    return 0;
  end if;

  select notify_exam_days_before into v_days_before
  from public.user_settings where user_id = v_uid;
  v_days_before := coalesce(v_days_before, 7);

  -- Rappels d'examen
  for r in
    select e.id, e.title, e.exam_date, c.name as course_name,
           (e.exam_date - current_date) as days
    from public.exams e
    join public.courses c on c.id = e.course_id
    where e.user_id = v_uid
      and e.exam_date >= current_date
      and (e.exam_date - current_date) <= v_days_before
  loop
    insert into public.notifications (user_id, type, title, message, related_entity_id, dedupe_key)
    values (
      v_uid, 'exam_reminder',
      case when r.days = 0 then 'Examen aujourd''hui : ' || r.course_name
           else 'Examen de ' || r.course_name || ' dans ' || r.days || ' jour' ||
                case when r.days > 1 then 's' else '' end end,
      r.title,
      r.id,
      'exam:' || r.id || ':' || r.days
    )
    on conflict (user_id, dedupe_key) do nothing;
    if found then v_created := v_created + 1; end if;
  end loop;

  -- Cartes dues aujourd'hui
  select count(*) into v_due
  from public.flashcards f
  left join public.flashcard_progress fp on fp.flashcard_id = f.id and fp.user_id = v_uid
  where f.user_id = v_uid and not f.archived
    and (fp.id is null or fp.next_review_at <= now());

  if v_due > 0 then
    insert into public.notifications (user_id, type, title, message, dedupe_key)
    values (
      v_uid, 'review_due',
      v_due || ' carte' || case when v_due > 1 then 's' else '' end || ' à réviser aujourd''hui',
      'Lance une session pour rester à jour.',
      'due:' || current_date::text
    )
    on conflict (user_id, dedupe_key) do nothing;
    if found then v_created := v_created + 1; end if;
  end if;

  return v_created;
end;
$$;

grant execute on function public.get_due_flashcards(uuid, uuid[], int, boolean) to authenticated;
grant execute on function public.get_weak_topics(uuid, int) to authenticated;
grant execute on function public.get_exam_readiness(uuid) to authenticated;
grant execute on function public.build_exam_session(uuid, int) to authenticated;
grant execute on function public.get_dashboard_summary() to authenticated;
grant execute on function public.get_progress_overview(int) to authenticated;
grant execute on function public.global_search(text, int) to authenticated;
grant execute on function public.refresh_notifications() to authenticated;
grant select on public.course_overview to authenticated;
