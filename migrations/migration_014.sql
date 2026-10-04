-- Lets a student permanently delete one of their own SUBMITTED attempts.
-- Additive: one new function. Run in the Supabase SQL Editor BEFORE deploying the
-- matching app update (if the app goes first, deleting just shows an error).
--
-- Deleting removes the attempt and its answers. Because Performance, Progress and the
-- leaderboard are calculated from the answers table, those answers stop counting
-- there too. Feedback sent after the attempt is kept (it simply loses its session
-- link). question_status (flags, "seen" history) is deliberately left alone.

create or replace function public.delete_attempt(p_attempt_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then raise exception 'Not authenticated'; end if;

  if not exists (select 1 from attempts
                  where id = p_attempt_id
                    and user_id = v_user
                    and status = 'submitted') then
    raise exception 'Attempt not found';
  end if;

  delete from responses where attempt_id = p_attempt_id;
  delete from attempts  where id = p_attempt_id and user_id = v_user;
end $function$;

revoke all on function public.delete_attempt(uuid) from public, anon;
grant execute on function public.delete_attempt(uuid) to authenticated;
