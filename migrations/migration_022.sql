-- Personal color theme and light/dark choice, saved on the student's profile so it follows
-- them to any device. Additive: two nullable columns and one new function; save_profile is
-- untouched. NULL means "use the default" (burgundy, and the device's light/dark setting).
-- Run BEFORE deploying the matching app update.

alter table public.student_profiles
  add column if not exists color_theme text,
  add column if not exists appearance text;

create or replace function public.save_appearance(p_color text, p_mode text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if p_color is not null and p_color not in ('burgundy', 'purple', 'blue', 'green', 'teal', 'orange') then
    raise exception 'Unknown color theme';
  end if;
  if p_mode is not null and p_mode not in ('light', 'dark') then
    raise exception 'Unknown appearance';
  end if;

  insert into student_profiles (user_id, color_theme, appearance, updated_at)
  values (v_user, p_color, p_mode, now())
  on conflict (user_id) do update
    set color_theme = p_color,
        appearance  = p_mode,
        updated_at  = now();
end $function$;

revoke all on function public.save_appearance(text, text) from public, anon;
grant execute on function public.save_appearance(text, text) to authenticated;
