-- Class average per question bank. Additive: one new function, no tables or student data touched.
-- Run BEFORE deploying the matching app update (until then the class-average line just doesn't show).
--
-- For each bank: take every student's MOST RECENT submitted session in which EVERY question was
-- answered (omitted/skipped questions disqualify a session), turn it into a percentage, and
-- average those percentages. One score per student, so retaking a bank doesn't count twice.
-- All session modes count, and so do admins' sessions. A bank only appears once at least 2
-- students have a qualifying score. Deleted attempts no longer exist, so they never count.
--
-- Security definer so students can see the aggregate without being able to read each other's
-- attempts. It returns only the bank's address and the average (never how many students).

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
       and coalesce(a.score_total, 0) > 0
       and (select count(*) from responses r
             where r.attempt_id = a.id and r.selected_choice_id is not null) = a.score_total
  ),
  latest as (
    select distinct on (user_id, qbank_id) user_id, qbank_id, pct
      from complete
     order by user_id, qbank_id, submitted_at desc
  )
  select b.slug,
         round(avg(l.pct), 1) as avg_pct
    from latest l
    join qbanks b on b.id = l.qbank_id
   where b.is_published or is_site_admin()
   group by b.slug
  having count(*) >= 2;
$function$;

revoke all on function public.class_averages() from public, anon;
grant execute on function public.class_averages() to authenticated;
