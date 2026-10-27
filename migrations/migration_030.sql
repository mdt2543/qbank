-- Past attempts on a hidden bank. Additive: one new function. Run BEFORE deploying the matching
-- app update (until then hidden banks just show no past attempts, as now).
--
-- The "Previous attempts" list used to join the bank table, which the database hides for
-- unpublished banks, so a hidden bank always looked like it had no history. This returns the
-- CALLER'S OWN submitted attempts on a bank whatever its published state, newest first.
-- It only ever returns the signed-in user's own rows.

create or replace function public.my_attempt_history(p_qbank_slug text)
 returns table (id uuid, mode text, submitted_at timestamptz, score_correct integer, score_total integer)
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select a.id,
         a.mode::text,
         a.submitted_at,
         a.score_correct::integer,
         a.score_total::integer
    from attempts a
    join qbanks b on b.id = a.qbank_id
   where a.user_id = auth.uid()
     and b.slug = p_qbank_slug
     and a.status = 'submitted'
   order by a.submitted_at desc
   limit 20;
$function$;

revoke all on function public.my_attempt_history(text) from public, anon;
grant execute on function public.my_attempt_history(text) to authenticated;
