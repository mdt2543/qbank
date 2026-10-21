-- Class average is only shown to students who have jump scare mode enabled.
-- Additive: replaces class_averages() with the same columns and adds one small function.
-- Run BEFORE deploying the matching app update.
--
-- class_averages() still returns a row for every bank that has a class average (2+ students),
-- but avg_pct is NULL unless the caller has jump scare mode on. So the screens can show a
-- "hidden" link without the number ever reaching the browser.
--
-- set_jumpscares(): turn jump scare mode on or off without touching the name or picture
-- (save_profile would overwrite those).

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

create or replace function public.set_jumpscares(p_enabled boolean)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  insert into student_profiles (user_id, jumpscares, updated_at)
  values (auth.uid(), coalesce(p_enabled, false), now())
  on conflict (user_id) do update
    set jumpscares = coalesce(p_enabled, false),
        updated_at = now();
end $function$;

revoke all on function public.set_jumpscares(boolean) from public, anon;
grant execute on function public.set_jumpscares(boolean) to authenticated;
