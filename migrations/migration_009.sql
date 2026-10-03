-- Opt-in setting for tutor-mode jump scares. Off by default for everyone.
-- Additive. Run in the Supabase SQL Editor BEFORE deploying the matching app update.

alter table public.student_profiles
  add column if not exists jumpscares boolean not null default false;

-- save_profile gains a third argument. NULL means "leave the setting as it is",
-- so the profile form can keep calling it with just a name and a picture.
drop function if exists public.save_profile(text, text);

create or replace function public.save_profile(p_display_name text, p_avatar_path text, p_jumpscares boolean default null)
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

  insert into student_profiles (user_id, display_name, avatar_path, jumpscares, updated_at)
  values (v_user, v_name, p_avatar_path, coalesce(p_jumpscares, false), now())
  on conflict (user_id) do update
    set display_name = excluded.display_name,
        avatar_path  = excluded.avatar_path,
        jumpscares   = coalesce(p_jumpscares, student_profiles.jumpscares),
        updated_at   = now();
exception
  when unique_violation then
    raise exception 'That display name is already taken';
end $function$;

grant execute on function public.save_profile(text, text, boolean) to authenticated;
