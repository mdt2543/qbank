-- CTAC note practice: the filled-in reference note the owner edits on /ctac/reference.
-- Additive: one new table (one row per reference note, e.g. 'well-visit') and one save function.
-- Admins only for now: only admins can read it, and saving goes through
-- admin_save_ctac_reference(), which checks is_site_admin(). Nothing else changes. Safe to re-run.
-- When the page is approved for students, the read policy below is the one line to change.

create table if not exists public.ctac_reference_notes (
  id          text primary key,
  subjective  text not null default '',
  objective   text not null default '',
  assessment  text not null default '',
  plan        text not null default '',
  signoff     text not null default '',
  updated_at  timestamptz not null default now(),
  updated_by  uuid
);

alter table public.ctac_reference_notes enable row level security;

drop policy if exists "ctac reference read" on public.ctac_reference_notes;
create policy "ctac reference read" on public.ctac_reference_notes
  for select to authenticated using (public.is_site_admin());

-- writes only go through the function below
revoke insert, update, delete on public.ctac_reference_notes from authenticated, anon;

create or replace function public.admin_save_ctac_reference(
  p_id text, p_subjective text, p_objective text, p_assessment text, p_plan text, p_signoff text)
 returns timestamptz
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_at timestamptz := now();
begin
  if not public.is_site_admin() then raise exception 'Admins only'; end if;
  if p_id is null or p_id !~ '^[a-z0-9-]{1,40}$' then raise exception 'Bad note id'; end if;

  insert into ctac_reference_notes (id, subjective, objective, assessment, plan, signoff, updated_at, updated_by)
  values (p_id, coalesce(p_subjective, ''), coalesce(p_objective, ''), coalesce(p_assessment, ''),
          coalesce(p_plan, ''), coalesce(p_signoff, ''), v_at, auth.uid())
  on conflict (id) do update
     set subjective = excluded.subjective, objective = excluded.objective,
         assessment = excluded.assessment, plan = excluded.plan, signoff = excluded.signoff,
         updated_at = excluded.updated_at, updated_by = excluded.updated_by;
  return v_at;
end;
$function$;

revoke all on function public.admin_save_ctac_reference(text, text, text, text, text, text) from public, anon;
grant execute on function public.admin_save_ctac_reference(text, text, text, text, text, text) to authenticated;
