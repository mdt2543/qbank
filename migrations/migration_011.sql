-- The admin page is limited to accounts in site_admins, a dedicated list that
-- nothing else uses. The old profiles.is_admin flag is no longer consulted.
-- Additive: one new table and a replaced function.
--
-- After running this, add your own account (kept out of this file on purpose, so
-- no email address is stored in the repository):
--   insert into public.site_admins (user_id)
--   select id from auth.users where lower(email) = lower('YOUR-EMAIL');

create table if not exists public.site_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

-- No client access at all; only is_site_admin() (below) reads it.
alter table public.site_admins enable row level security;
revoke all on public.site_admins from anon, authenticated;

create or replace function public.is_site_admin()
 returns boolean
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select exists (select 1 from public.site_admins where user_id = auth.uid());
$function$;
