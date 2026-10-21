-- Color spectrum: a student can pick any hue, stored as 'h0' ... 'h359' in
-- student_profiles.color_theme (the preset names keep working). Additive: replaces
-- save_appearance() only. Run BEFORE deploying the matching app update.

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
  if p_color is not null
     and p_color not in ('burgundy', 'purple', 'blue', 'green', 'teal', 'orange')
     and p_color !~ '^h([0-9]|[1-9][0-9]|[12][0-9][0-9]|3[0-5][0-9])$' then
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
