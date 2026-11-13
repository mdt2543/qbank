-- Leaderboard animals: students without a profile picture show an animal instead of initials.
-- Everyone starts as a platypus; the leaderboard asks once (when avatar_animal is still NULL) and
-- the choice can be changed later on the Profile page. An uploaded picture always wins.
-- Additive: one nullable column and one new function; leaderboard() gains one return column, so
-- it is dropped and re-created with the same ranking. No answers or scores change. Safe to re-run.
-- Run BEFORE deploying the matching app update.

alter table public.student_profiles
  add column if not exists avatar_animal text;

create or replace function public.save_avatar_animal(p_animal text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if p_animal not in ('platypus', 'koala', 'fox', 'wolf', 'panda', 'owl', 'penguin', 'frog', 'tiger', 'bunny') then
    raise exception 'Unknown animal';
  end if;

  insert into student_profiles (user_id, avatar_animal, updated_at)
  values (v_user, p_animal, now())
  on conflict (user_id) do update
    set avatar_animal = p_animal,
        updated_at = now();
end $function$;

revoke all on function public.save_avatar_animal(text) from public, anon;
grant execute on function public.save_avatar_animal(text) to authenticated;

drop function if exists public.leaderboard();

create function public.leaderboard()
 returns table (place bigint, display_name text, avatar_path text, avatar_animal text,
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
    select p.user_id, p.display_name, p.avatar_path, p.avatar_animal, p.jumpscare_count,
           coalesce(t.n, 0) as n
      from student_profiles p
      join auth.users u on u.id = p.user_id
      left join totals t on t.user_id = p.user_id
     where p.display_name is not null
       and (u.banned_until is null or u.banned_until < now())
  ),
  ranked as (
    select b.*, rank() over (order by b.n desc) as rk from board b
  )
  select r.rk, r.display_name, r.avatar_path, r.avatar_animal, r.n, r.jumpscare_count,
         (r.user_id = auth.uid())
    from ranked r
   where r.rk <= 50 or r.user_id = auth.uid()
   order by r.rk, lower(r.display_name);
$function$;

revoke all on function public.leaderboard() from public, anon;
grant execute on function public.leaderboard() to authenticated;
