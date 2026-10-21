-- Admin page: accurate numbers. Additive: three new functions (the old admin_* ones are left as
-- they are). Run BEFORE deploying the matching app update.
--
-- Changes in meaning:
--  * Admin accounts (profiles.is_admin) are left out unless p_include_admins is true.
--  * Scores use each student's NEWEST answer to each question, matching the Performance page.
--  * "Questions answered" counts distinct questions, so retaking a bank doesn't count twice.
--  * "Completed" = the student has a submitted session with every question answered, the same
--    rule the class average uses; the class average here is the same number students see
--    (but shown to you even when fewer than 2 students qualify).
-- Every function returns nothing to anyone who is not an admin.

create or replace function public.admin_overview_v2(p_include_admins boolean default false)
 returns table (students bigint, active_7d bigint, sessions_submitted bigint, questions_answered bigint)
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select
    (select count(*) from auth.users u
      where p_include_admins or not coalesce((select p.is_admin from profiles p where p.id = u.id), false)),
    (select count(distinct a.user_id)
       from attempts a join responses r on r.attempt_id = a.id
      where r.selected_choice_id is not null
        and r.answered_at > now() - interval '7 days'
        and (p_include_admins or not coalesce((select p.is_admin from profiles p where p.id = a.user_id), false))),
    (select count(*) from attempts a
      where a.submitted_at is not null
        and (p_include_admins or not coalesce((select p.is_admin from profiles p where p.id = a.user_id), false))),
    (select count(distinct a.user_id::text || ':' || r.question_id::text)
       from attempts a join responses r on r.attempt_id = a.id
      where r.selected_choice_id is not null
        and (p_include_admins or not coalesce((select p.is_admin from profiles p where p.id = a.user_id), false)))
  where public.is_site_admin();
$function$;

-- One row per bank.
create or replace function public.admin_bank_summary_v2(p_include_admins boolean default false)
 returns table (bank text, bank_slug text, is_published boolean, started bigint, completed bigint,
                class_avg numeric, avg_seen numeric, question_count bigint,
                sessions_submitted bigint, last_active timestamptz)
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  with att as (
    select a.* from attempts a
     where p_include_admins
        or not coalesce((select p.is_admin from profiles p where p.id = a.user_id), false)
  ),
  seen as (
    select a.qbank_id, a.user_id,
           count(distinct r.question_id) as n,
           max(r.answered_at) as last_at
      from att a
      join responses r on r.attempt_id = a.id and r.selected_choice_id is not null
     group by a.qbank_id, a.user_id
  ),
  complete as (
    select a.user_id, a.qbank_id, a.submitted_at,
           100.0 * a.score_correct / a.score_total as pct
      from att a
     where a.submitted_at is not null
       and coalesce(a.score_total, 0) > 0
       and (select count(*) from responses r
             where r.attempt_id = a.id and r.selected_choice_id is not null) = a.score_total
  ),
  latest as (
    select distinct on (user_id, qbank_id) user_id, qbank_id, pct
      from complete
     order by user_id, qbank_id, submitted_at desc
  )
  select b.title,
         b.slug,
         b.is_published,
         (select count(distinct a.user_id) from att a where a.qbank_id = b.id),
         (select count(*) from latest l where l.qbank_id = b.id),
         (select round(avg(l.pct), 1) from latest l where l.qbank_id = b.id),
         (select round(avg(s.n), 1) from seen s where s.qbank_id = b.id),
         (select count(*) from questions q where q.qbank_id = b.id and not q.is_retired),
         (select count(*) from att a where a.qbank_id = b.id and a.submitted_at is not null),
         (select max(s.last_at) from seen s where s.qbank_id = b.id)
    from qbanks b
   where public.is_site_admin()
   order by b.created_at;
$function$;

-- One row per student per bank they have started.
create or replace function public.admin_student_activity_v2(p_include_admins boolean default false)
 returns table (user_id uuid, email text, display_name text, is_admin boolean,
                bank text, bank_slug text, questions_seen bigint, pct_latest numeric,
                sessions bigint, submitted bigint, last_active timestamptz)
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  with ans as (
    select distinct on (a.user_id, a.qbank_id, r.question_id)
           a.user_id, a.qbank_id, r.question_id, r.is_correct, r.answered_at
      from attempts a
      join responses r on r.attempt_id = a.id and r.selected_choice_id is not null
     order by a.user_id, a.qbank_id, r.question_id, r.answered_at desc
  ),
  agg as (
    select user_id, qbank_id,
           count(*) as seen,
           round(100.0 * count(*) filter (where is_correct) / nullif(count(*), 0), 1) as pct,
           max(answered_at) as last_at
      from ans
     group by user_id, qbank_id
  ),
  ses as (
    select user_id, qbank_id,
           count(*) as sessions,
           count(*) filter (where submitted_at is not null) as submitted
      from attempts
     group by user_id, qbank_id
  )
  select s.user_id,
         u.email::text,
         sp.display_name,
         coalesce(pr.is_admin, false),
         b.title,
         b.slug,
         coalesce(ag.seen, 0),
         ag.pct,
         s.sessions,
         s.submitted,
         ag.last_at
    from ses s
    join qbanks b on b.id = s.qbank_id
    join auth.users u on u.id = s.user_id
    left join student_profiles sp on sp.user_id = s.user_id
    left join profiles pr on pr.id = s.user_id
    left join agg ag on ag.user_id = s.user_id and ag.qbank_id = s.qbank_id
   where public.is_site_admin()
     and (p_include_admins or not coalesce(pr.is_admin, false))
   order by ag.last_at desc nulls last;
$function$;

revoke all on function public.admin_overview_v2(boolean) from public, anon;
revoke all on function public.admin_bank_summary_v2(boolean) from public, anon;
revoke all on function public.admin_student_activity_v2(boolean) from public, anon;
grant execute on function public.admin_overview_v2(boolean) to authenticated;
grant execute on function public.admin_bank_summary_v2(boolean) to authenticated;
grant execute on function public.admin_student_activity_v2(boolean) to authenticated;
