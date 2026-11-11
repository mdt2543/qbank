-- Home page "Session in progress" markers and the "Continue where you left off" list.
-- Additive: one read-only function. No student data is touched. Safe to re-run.
-- Run BEFORE deploying the matching app update (until then the home page shows no markers).
--
-- One row per bank where the signed-in student has a session they can resume: the same rules as
-- resume_attempt() in migration_005.sql (tutor or untimed exam mode, not finished or discarded,
-- started in the last 14 days, at least one answer), so a marker always means the bank page
-- offers Resume. Keep the two in step if those rules change.

create or replace function public.my_open_sessions()
 returns table (slug text, mode text, answered bigint, total integer,
                started_at timestamptz, last_activity timestamptz)
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select distinct on (b.slug)
         b.slug,
         t.mode::text,
         (select count(*) from responses r
           where r.attempt_id = t.id and r.selected_choice_id is not null),
         coalesce(cardinality(t.question_ids), 0),
         t.started_at,
         coalesce((select max(r.answered_at) from responses r where r.attempt_id = t.id),
                  t.started_at)
    from attempts t
    join qbanks b on b.id = t.qbank_id
   where t.user_id = auth.uid()
     and t.status = 'in_progress'
     and t.abandoned_at is null
     and t.mode::text in ('tutor', 'timed')
     and t.started_at > now() - interval '14 days'
     and exists (select 1 from responses r where r.attempt_id = t.id)
     and (b.is_published or is_site_admin())
   order by b.slug, t.started_at desc;
$function$;

revoke all on function public.my_open_sessions() from public, anon;
grant execute on function public.my_open_sessions() to authenticated;
