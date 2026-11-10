-- Course order for sessions: when each session first meets, so sessions can be listed in the order
-- they were taught. Used by:
--   * the home page: inside each Case folder, banks are listed in course order
--     (qbank_session_starts);
--   * reviewing an attempt: "By session" groups a practice exam's questions by case and session,
--     in course order (qbank_question_sessions).
-- Additive: one new column and two read-only functions. No student data is touched.
-- Run this BEFORE migration_case_sessions.sql (which fills in the dates) and before deploying
-- the matching app update (until then the home page keeps upload order and "By session" is hidden).
-- Safe to re-run.

alter table public.case_objectives add column if not exists session_starts_at timestamp;

-- One row per question in a bank: the case and session its objective belongs to. Published banks
-- only (any bank for an admin). An objective listed under more than one case uses the lowest case.
create or replace function public.qbank_question_sessions(p_slug text)
 returns table (question_id uuid, case_number integer, case_title text,
                session_title text, session_starts_at timestamp)
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select distinct on (q.id)
         q.id, c.number, c.title, co.session_title, co.session_starts_at
    from qbanks b
    join questions q on q.qbank_id = b.id
    join topics t on t.id = q.topic_id
    join case_objectives co on 'Objective ' || co.code = t.name
    join cases c on c.number = co.case_number
   where b.slug = p_slug
     and (b.is_published or is_site_admin())
   order by q.id, c.number;
$function$;

revoke all on function public.qbank_question_sessions(text) from public, anon;
grant execute on function public.qbank_question_sessions(text) to authenticated;

-- One row per bank: when its earliest session first meets. For a bank in a Case folder
-- (subfolder case-N) only that case's sessions count.
create or replace function public.qbank_session_starts()
 returns table (slug text, starts_at timestamp)
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select b.slug, min(co.session_starts_at)
    from qbanks b
    join questions q on q.qbank_id = b.id
    join topics t on t.id = q.topic_id
    join case_objectives co on 'Objective ' || co.code = t.name
   where (b.is_published or is_site_admin())
     and co.session_starts_at is not null
     and (coalesce(b.subfolder, '') !~ '^case-[0-9]+$'
          or co.case_number = substring(b.subfolder from '^case-([0-9]+)$')::integer)
   group by b.slug;
$function$;

revoke all on function public.qbank_session_starts() from public, anon;
grant execute on function public.qbank_session_starts() to authenticated;
