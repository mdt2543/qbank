-- Leaderboard: show how many times each student has been jump scared.
-- Run in the Supabase SQL Editor BEFORE deploying the matching app update (if the app goes
-- first, the leaderboard shows no count and scares are simply not recorded). Safe to re-run.
--
-- Scares were never stored before this, so every count starts at 0.
-- record_jumpscare(): called by the question screen each time a scare plays. It ignores a
-- call made within 60 seconds of the previous one, so the count can't be pumped up by calling
-- it in a loop (real scares are 1-in-10,000 per second, far rarer than that).
-- leaderboard(): same ranking as before (unique questions answered), plus the scare count.
-- Its return columns change, so it is dropped and re-created.

alter table public.student_profiles
  add column if not exists jumpscare_count integer not null default 0,
  add column if not exists last_jumpscare_at timestamptz;

create or replace function public.record_jumpscare()
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  update student_profiles
     set jumpscare_count = jumpscare_count + 1,
         last_jumpscare_at = now()
   where user_id = auth.uid()
     and jumpscares
     and (last_jumpscare_at is null or last_jumpscare_at < now() - interval '60 seconds');
end $function$;

revoke all on function public.record_jumpscare() from public, anon;
grant execute on function public.record_jumpscare() to authenticated;

drop function if exists public.leaderboard();

create function public.leaderboard()
 returns table (place bigint, display_name text, avatar_path text,
                total_questions bigint, jumpscares integer, is_me boolean)
 language sql
 security definer
 set search_path to 'public'
as $function$
  with totals as (
    select a.user_id, count(distinct r.question_id) as n
      from responses r
      join attempts a on a.id = r.attempt_id
     where r.selected_choice_id is not null
     group by a.user_id
  ),
  board as (
    select p.user_id, p.display_name, p.avatar_path, p.jumpscare_count, coalesce(t.n, 0) as n
      from student_profiles p
      join auth.users u on u.id = p.user_id
      left join totals t on t.user_id = p.user_id
     where p.display_name is not null
       and (u.banned_until is null or u.banned_until < now())
  ),
  ranked as (
    select b.*, rank() over (order by b.n desc) as rk from board b
  )
  select r.rk, r.display_name, r.avatar_path, r.n, r.jumpscare_count, (r.user_id = auth.uid())
    from ranked r
   where r.rk <= 50 or r.user_id = auth.uid()
   order by r.rk, lower(r.display_name);
$function$;

revoke all on function public.leaderboard() from public, anon;
grant execute on function public.leaderboard() to authenticated;
