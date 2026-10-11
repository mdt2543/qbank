-- First-login tutorial. Additive: one new table and two new functions.
-- Run in the Supabase SQL Editor BEFORE deploying the matching app update (if the app
-- goes first, the tutorial simply never shows).
--
-- Nobody is marked as having seen it, so EVERY account (existing students and new ones)
-- sees the tutorial once, on their next page load. It is recorded as seen the moment it
-- first appears. Anyone can replay it from the Profile page.
--
-- To show it to everyone again later (for example after adding new features):
--   delete from public.tutorial_seen;
-- To show it to one student again:
--   delete from public.tutorial_seen
--    where user_id = (select id from auth.users where email = 'student@example.edu');
-- To skip it for everyone who has an account right now:
--   insert into public.tutorial_seen (user_id) select id from auth.users on conflict do nothing;

create table if not exists public.tutorial_seen (
  user_id uuid primary key references auth.users(id) on delete cascade,
  seen_at timestamptz not null default now()
);

alter table public.tutorial_seen enable row level security;
revoke all on public.tutorial_seen from anon, authenticated;

create or replace function public.has_seen_tutorial()
 returns boolean
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select exists (select 1 from public.tutorial_seen where user_id = auth.uid());
$function$;

create or replace function public.mark_tutorial_seen()
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  insert into public.tutorial_seen (user_id) values (auth.uid())
  on conflict do nothing;
end $function$;

revoke all on function public.has_seen_tutorial() from public, anon;
revoke all on function public.mark_tutorial_seen() from public, anon;
grant execute on function public.has_seen_tutorial() to authenticated;
grant execute on function public.mark_tutorial_seen() to authenticated;
