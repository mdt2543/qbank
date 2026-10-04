-- Admin page support. Additive: new functions only.
-- Run in the Supabase SQL Editor BEFORE deploying the matching app update.
--
-- Who counts as an admin is decided in ONE place, is_site_admin(): the is_admin
-- flag on the existing public.profiles table (profiles.id = the user's id).
-- Check who has it before relying on this:
--   select p.id, u.email, p.is_admin
--     from public.profiles p join auth.users u on u.id = p.id
--    order by p.is_admin desc;
-- Every admin_* function below returns nothing to anyone who is not an admin,
-- so the data stays private even if someone calls the functions directly.

create or replace function public.is_site_admin()
 returns boolean
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false);
$function$;

-- One row per student per bank they have worked on.
create or replace function public.admin_student_activity()
 returns table (user_id uuid, email text, display_name text, bank text, bank_slug text,
                questions_answered bigint, sessions bigint, submitted bigint,
                pct_correct numeric, last_active timestamptz)
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select a.user_id,
         u.email::text,
         sp.display_name,
         b.title,
         b.slug,
         count(distinct r.question_id),
         count(distinct a.id),
         count(distinct a.id) filter (where a.status = 'submitted'),
         round(100.0 * count(*) filter (where r.is_correct)
               / nullif(count(r.question_id), 0), 1),
         max(r.answered_at)
    from attempts a
    join qbanks b on b.id = a.qbank_id
    join auth.users u on u.id = a.user_id
    left join student_profiles sp on sp.user_id = a.user_id
    left join responses r on r.attempt_id = a.id and r.selected_choice_id is not null
   where public.is_site_admin()
   group by a.user_id, u.email, sp.display_name, b.title, b.slug
   order by max(r.answered_at) desc nulls last;
$function$;

-- One row per bank.
create or replace function public.admin_bank_summary()
 returns table (bank text, bank_slug text, students bigint, sessions bigint,
                unique_answers bigint, question_count bigint, last_active timestamptz)
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select b.title,
         b.slug,
         count(distinct a.user_id),
         count(distinct a.id),
         count(distinct a.user_id::text || ':' || r.question_id::text),
         (select count(*) from questions q where q.qbank_id = b.id and not q.is_retired),
         max(r.answered_at)
    from qbanks b
    left join attempts a on a.qbank_id = b.id
    left join responses r on r.attempt_id = a.id and r.selected_choice_id is not null
   where public.is_site_admin()
   group by b.id, b.title, b.slug, b.created_at
   order by b.created_at;
$function$;

-- Headline numbers.
create or replace function public.admin_overview()
 returns table (accounts bigint, active_7d bigint, answers bigint)
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select (select count(*) from auth.users),
         (select count(distinct a.user_id)
            from attempts a join responses r on r.attempt_id = a.id
           where r.answered_at > now() - interval '7 days'),
         (select count(*) from responses where selected_choice_id is not null)
   where public.is_site_admin();
$function$;

revoke all on function public.is_site_admin() from public, anon;
revoke all on function public.admin_student_activity() from public, anon;
revoke all on function public.admin_bank_summary() from public, anon;
revoke all on function public.admin_overview() from public, anon;
grant execute on function public.is_site_admin() to authenticated;
grant execute on function public.admin_student_activity() to authenticated;
grant execute on function public.admin_bank_summary() to authenticated;
grant execute on function public.admin_overview() to authenticated;
