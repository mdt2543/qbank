-- Profiles (display name + private profile picture), leaderboard, and progress
-- tracking. Additive: new tables, views, functions and a storage bucket only.
-- Run in the Supabase SQL Editor BEFORE deploying the matching app update.

-- ---------------------------------------------------------------- student_profiles

create table if not exists public.student_profiles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_path  text,
  updated_at   timestamptz not null default now(),
  constraint display_name_length
    check (display_name is null or char_length(display_name) between 2 and 30)
);

-- One display name per student (case-insensitive) so nobody can pose as another.
create unique index if not exists student_profiles_display_name_key
  on public.student_profiles (lower(display_name)) where display_name is not null;

alter table public.student_profiles enable row level security;

drop policy if exists "read own profile" on public.student_profiles;
create policy "read own profile" on public.student_profiles
  for select to authenticated using (user_id = auth.uid());

-- Writes only go through save_profile(); nothing can be changed directly.
revoke insert, update, delete on public.student_profiles from authenticated, anon;

create or replace function public.save_profile(p_display_name text, p_avatar_path text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_user uuid := auth.uid();
  v_name text := nullif(btrim(p_display_name), '');
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if v_name is not null and char_length(v_name) not between 2 and 30 then
    raise exception 'Display name must be 2 to 30 characters';
  end if;
  if p_avatar_path is not null and split_part(p_avatar_path, '/', 1) <> v_user::text then
    raise exception 'Invalid picture path';
  end if;

  insert into student_profiles (user_id, display_name, avatar_path, updated_at)
  values (v_user, v_name, p_avatar_path, now())
  on conflict (user_id) do update
    set display_name = excluded.display_name,
        avatar_path  = excluded.avatar_path,
        updated_at   = now();
exception
  when unique_violation then
    raise exception 'That display name is already taken';
end $function$;

grant execute on function public.save_profile(text, text) to authenticated;

-- ---------------------------------------------------- private picture bucket

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 524288, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Any signed-in student can read pictures (needed to show the leaderboard), but
-- there are no public links, and each student can only write inside their own folder.
drop policy if exists "avatars read" on storage.objects;
create policy "avatars read" on storage.objects
  for select to authenticated using (bucket_id = 'avatars');

drop policy if exists "avatars insert own" on storage.objects;
create policy "avatars insert own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars update own" on storage.objects;
create policy "avatars update own" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars delete own" on storage.objects;
create policy "avatars delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ------------------------------------------------------------- leaderboard
-- Shows only: place, display name, picture and total unique questions answered.
-- Only students who chose a display name appear. Banned accounts are excluded.
-- Returns the top 50, plus the caller's own row if they are further down.

create or replace function public.leaderboard()
 returns table (place bigint, display_name text, avatar_path text,
                total_questions bigint, is_me boolean)
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
    select p.user_id, p.display_name, p.avatar_path, coalesce(t.n, 0) as n
      from student_profiles p
      join auth.users u on u.id = p.user_id
      left join totals t on t.user_id = p.user_id
     where p.display_name is not null
       and (u.banned_until is null or u.banned_until < now())
  ),
  ranked as (
    select b.*, rank() over (order by b.n desc) as rk from board b
  )
  select r.rk, r.display_name, r.avatar_path, r.n, (r.user_id = auth.uid())
    from ranked r
   where r.rk <= 50 or r.user_id = auth.uid()
   order by r.rk, lower(r.display_name);
$function$;

grant execute on function public.leaderboard() to authenticated;

-- ------------------------------------------------------ progress over time

-- Lifetime totals for the signed-in student.
create or replace view public.v_my_totals as
  select count(*) as answers,
         count(distinct r.question_id) as questions
    from responses r
    join attempts a on a.id = r.attempt_id
   where a.user_id = auth.uid()
     and r.selected_choice_id is not null;

-- Per week (Mondays): answers given, and questions answered for the first time.
create or replace view public.v_my_weekly_activity as
  with mine as (
    select r.question_id, r.answered_at
      from responses r
      join attempts a on a.id = r.attempt_id
     where a.user_id = auth.uid()
       and r.selected_choice_id is not null
  ),
  firsts as (
    select question_id, min(answered_at) as first_at from mine group by question_id
  ),
  weeks as (
    select date_trunc('week', answered_at)::date as week from mine
    union
    select date_trunc('week', first_at)::date from firsts
  )
  select w.week,
         coalesce(m.answers, 0)       as answers,
         coalesce(f.new_questions, 0) as new_questions
    from weeks w
    left join (select date_trunc('week', answered_at)::date as week, count(*) as answers
                 from mine group by 1) m on m.week = w.week
    left join (select date_trunc('week', first_at)::date as week, count(*) as new_questions
                 from firsts group by 1) f on f.week = w.week
   order by w.week;

-- Improvement by case: accuracy on the first-ever answer to each question versus
-- the most recent answer. A question counts toward every case its objective is in.
create or replace view public.v_my_case_progress as
  with ranked as (
    select r.question_id, r.is_correct,
           row_number() over (partition by r.question_id order by r.answered_at asc)  as rn_first,
           row_number() over (partition by r.question_id order by r.answered_at desc) as rn_last
      from responses r
      join attempts a on a.id = r.attempt_id
     where a.user_id = auth.uid()
       and r.selected_choice_id is not null
  ),
  per_q as (
    select question_id,
           max(is_correct::int) filter (where rn_first = 1) as first_ok,
           max(is_correct::int) filter (where rn_last = 1)  as last_ok,
           count(*) as tries
      from ranked
     group by question_id
  )
  select c.number as case_number,
         c.title,
         count(*) as questions,
         count(*) filter (where p.tries > 1) as retaken,
         round(100.0 * avg(p.first_ok), 1) as first_pct,
         round(100.0 * avg(p.last_ok), 1)  as latest_pct
    from per_q p
    join questions q on q.id = p.question_id
    join topics t on t.id = q.topic_id
    join case_objectives co on 'Objective ' || co.code = t.name
    join cases c on c.number = co.case_number
   group by c.number, c.title
   order by c.number;

grant select on public.v_my_totals to authenticated;
grant select on public.v_my_weekly_activity to authenticated;
grant select on public.v_my_case_progress to authenticated;
