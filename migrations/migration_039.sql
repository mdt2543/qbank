-- "Retry missed": a new session made only of the questions a student missed (answered wrong or
-- left unanswered) on one of their own finished attempts.
-- Additive: one nullable column on attempts and one new function. Two existing functions get the
-- same definitions plus "retries don't count", and my_attempt_history gains one return column (so
-- it is dropped and re-created). No answers, scores or attempts change. Safe to re-run.
-- Run BEFORE deploying the matching app update.
--
-- attempts.retry_of: the attempt a retry was made from. Deliberately not a foreign key, so a retry
-- stays marked as a retry even if the student later deletes the original.
-- Retries are left out of the class average (class_averages, admin_bank_summary_v2), which use each
-- student's most recent complete session: a short retry would otherwise replace it. Performance and
-- the leaderboard count each question's latest answer and need no change.

alter table public.attempts
  add column if not exists retry_of uuid;

create or replace function public.start_retry_attempt(p_attempt_id uuid, p_mode attempt_mode default 'tutor'::attempt_mode)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_user uuid := auth.uid();
  v_bank uuid;
  v_ids  uuid[];
  v_new  uuid;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;

  -- only the student's own finished attempt, on a bank they can still open
  select a.qbank_id into v_bank
    from attempts a
    join qbanks b on b.id = a.qbank_id
   where a.id = p_attempt_id
     and a.user_id = v_user
     and a.status = 'submitted'
     and ((b.is_published and (b.available_at is null or b.available_at <= now()))
          or public.is_site_admin());
  if v_bank is null then raise exception 'Attempt not available'; end if;

  -- that attempt's questions not answered correctly (wrong or unanswered), still in the bank
  select array_agg(q.id order by random()) into v_ids
    from attempts a
    cross join lateral unnest(a.question_ids) as u(qid)
    join questions q on q.id = u.qid and not q.is_retired
    left join responses r on r.attempt_id = a.id and r.question_id = u.qid
   where a.id = p_attempt_id
     and not coalesce(r.is_correct, false);

  if v_ids is null or array_length(v_ids, 1) is null then
    raise exception 'No missed questions in that attempt';
  end if;

  insert into attempts (user_id, qbank_id, mode, question_ids, time_limit_seconds, retry_of)
  values (v_user, v_bank, p_mode, v_ids,
          case when p_mode::text in ('timed', 'timed_exam')
               then array_length(v_ids, 1) * 90 else null end,
          p_attempt_id)
  returning id into v_new;

  return v_new;
end $function$;

revoke all on function public.start_retry_attempt(uuid, attempt_mode) from public, anon;
grant execute on function public.start_retry_attempt(uuid, attempt_mode) to authenticated;

-- the bank page's "Previous attempts" list, now saying which ones are retries
drop function if exists public.my_attempt_history(text);

create function public.my_attempt_history(p_qbank_slug text)
 returns table (id uuid, mode text, submitted_at timestamptz, score_correct integer, score_total integer,
                is_retry boolean)
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select a.id,
         a.mode::text,
         a.submitted_at,
         a.score_correct::integer,
         a.score_total::integer,
         a.retry_of is not null
    from attempts a
    join qbanks b on b.id = a.qbank_id
   where a.user_id = auth.uid()
     and b.slug = p_qbank_slug
     and a.status = 'submitted'
   order by a.submitted_at desc
   limit 20;
$function$;

revoke all on function public.my_attempt_history(text) from public, anon;
grant execute on function public.my_attempt_history(text) to authenticated;

-- class average for students (same as migration_027, retries left out)
create or replace function public.class_averages()
 returns table (slug text, avg_pct numeric)
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  with complete as (
    select a.user_id,
           a.qbank_id,
           a.submitted_at,
           100.0 * a.score_correct / a.score_total as pct
      from attempts a
     where a.submitted_at is not null
       and a.retry_of is null
       and coalesce(a.score_total, 0) > 0
       and (select count(*) from responses r
             where r.attempt_id = a.id and r.selected_choice_id is not null) = a.score_total
  ),
  latest as (
    select distinct on (user_id, qbank_id) user_id, qbank_id, pct
      from complete
     order by user_id, qbank_id, submitted_at desc
  ),
  me as (
    select coalesce((select sp.jumpscares from student_profiles sp where sp.user_id = auth.uid()), false) as on_
  )
  select b.slug,
         case when (select on_ from me) then round(avg(l.pct), 1) else null end
    from latest l
    join qbanks b on b.id = l.qbank_id
   where b.is_published or is_site_admin()
   group by b.slug
  having count(*) >= 2;
$function$;

-- admin Banks tab (same as migration_026, retries left out of Completed and Class average)
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
       and a.retry_of is null
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
