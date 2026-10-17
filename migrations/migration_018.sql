-- Site announcements. Additive: two new tables and several new functions.
-- Run in the Supabase SQL Editor (or with the command line) BEFORE deploying the matching
-- app update. If the app goes first, announcements simply never show and the admin
-- announcement form reports an error; nothing else is affected.
--
-- Announcements are written on the admin page. Each logged-in student sees the live ones
-- as a banner at the top of the normal pages (never during a question session) and can
-- dismiss each one; a dismissed announcement does not come back for that student.

create table if not exists public.announcements (
  id         uuid primary key default gen_random_uuid(),
  message    text not null check (char_length(btrim(message)) between 1 and 500),
  level      text not null default 'info' check (level in ('info', 'important')),
  active     boolean not null default true,
  starts_at  timestamptz not null default now(),
  ends_at    timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.announcement_dismissals (
  user_id         uuid not null references auth.users(id) on delete cascade,
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  dismissed_at    timestamptz not null default now(),
  primary key (user_id, announcement_id)
);

-- No direct access for anyone: everything goes through the functions below.
alter table public.announcements enable row level security;
alter table public.announcement_dismissals enable row level security;
revoke all on public.announcements from anon, authenticated;
revoke all on public.announcement_dismissals from anon, authenticated;

-- What the signed-in student should see right now.
create or replace function public.current_announcements()
 returns table (id uuid, message text, level text)
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select a.id, a.message, a.level
    from announcements a
   where auth.uid() is not null
     and a.active
     and a.starts_at <= now()
     and (a.ends_at is null or a.ends_at > now())
     and not exists (select 1 from announcement_dismissals d
                      where d.announcement_id = a.id and d.user_id = auth.uid())
   order by a.created_at desc;
$function$;

create or replace function public.dismiss_announcement(p_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  insert into announcement_dismissals (user_id, announcement_id)
  values (auth.uid(), p_id)
  on conflict do nothing;
end $function$;

-- ---------------------------------------------------------------- admin only

create or replace function public.admin_announcements()
 returns table (id uuid, message text, level text, active boolean,
                starts_at timestamptz, ends_at timestamptz, created_at timestamptz,
                dismissed_count bigint)
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select a.id, a.message, a.level, a.active, a.starts_at, a.ends_at, a.created_at,
         (select count(*) from announcement_dismissals d where d.announcement_id = a.id)
    from announcements a
   where public.is_site_admin()
   order by a.created_at desc;
$function$;

-- Creates an announcement, or updates one when p_id is given.
create or replace function public.admin_save_announcement(
  p_message text,
  p_level   text default 'info',
  p_ends_at timestamptz default null,
  p_active  boolean default true,
  p_id      uuid default null)
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_id  uuid;
  v_msg text := btrim(coalesce(p_message, ''));
begin
  if not public.is_site_admin() then raise exception 'Not authorized'; end if;
  if char_length(v_msg) = 0 then raise exception 'Please write a message'; end if;
  if char_length(v_msg) > 500 then raise exception 'Please keep it under 500 characters'; end if;
  if p_level not in ('info', 'important') then raise exception 'Unknown level'; end if;

  if p_id is null then
    insert into announcements (message, level, active, ends_at)
    values (v_msg, p_level, coalesce(p_active, true), p_ends_at)
    returning id into v_id;
  else
    update announcements
       set message = v_msg, level = p_level, active = coalesce(p_active, true), ends_at = p_ends_at
     where id = p_id
    returning id into v_id;
    if v_id is null then raise exception 'Announcement not found'; end if;
  end if;
  return v_id;
end $function$;

create or replace function public.admin_delete_announcement(p_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not public.is_site_admin() then raise exception 'Not authorized'; end if;
  delete from announcements where id = p_id;
end $function$;

revoke all on function public.current_announcements() from public, anon;
revoke all on function public.dismiss_announcement(uuid) from public, anon;
revoke all on function public.admin_announcements() from public, anon;
revoke all on function public.admin_save_announcement(text, text, timestamptz, boolean, uuid) from public, anon;
revoke all on function public.admin_delete_announcement(uuid) from public, anon;
grant execute on function public.current_announcements() to authenticated;
grant execute on function public.dismiss_announcement(uuid) to authenticated;
grant execute on function public.admin_announcements() to authenticated;
grant execute on function public.admin_save_announcement(text, text, timestamptz, boolean, uuid) to authenticated;
grant execute on function public.admin_delete_announcement(uuid) to authenticated;
