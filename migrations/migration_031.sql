-- Admin page: add each student's last sign-in time (from Supabase Auth) next to "last active"
-- (their most recent answer). Safe to re-run.
drop function if exists public.admin_student_activity_v2(boolean);

create function public.admin_student_activity_v2(p_include_admins boolean default false)
 returns table (user_id uuid, email text, display_name text, is_admin boolean,
                bank text, bank_slug text, questions_seen bigint, pct_latest numeric,
                sessions bigint, submitted bigint, last_active timestamptz, last_sign_in timestamptz)
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
         ag.last_at,
         u.last_sign_in_at
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

revoke all on function public.admin_student_activity_v2(boolean) from public, anon;
grant execute on function public.admin_student_activity_v2(boolean) to authenticated;
