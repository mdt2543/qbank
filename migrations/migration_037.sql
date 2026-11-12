-- Review page timing: attempt_review() also returns how long each answer took (seconds_spent).
-- Read-only function change; no student data is touched. Safe to re-run.
-- Same as migration_004.sql plus the 'seconds_spent' field. Run before or after deploying the
-- matching app update (the app shows no times until this has run).

create or replace function public.attempt_review(p_attempt_id uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_user uuid := auth.uid();
  v_ids  uuid[];
begin
  select question_ids into v_ids from attempts
   where id = p_attempt_id and user_id = v_user and status = 'submitted';
  if v_ids is null then raise exception 'Attempt not submitted'; end if;

  return (
    select coalesce(jsonb_agg(jsonb_build_object(
             'question_id',        u.qid,
             'selected_choice_id', r.selected_choice_id,
             'is_correct',         coalesce(r.is_correct, false),
             'correct_choice_id',  (select c.id from choices c
                                     where c.question_id = u.qid and c.is_correct),
             'explanation',        (select explanation from questions where id = u.qid),
             'rationales',         (select jsonb_object_agg(c.id, c.rationale)
                                      from choices c where c.question_id = u.qid),
             'seconds_spent',      r.seconds_spent
           ) order by u.ord), '[]'::jsonb)
      from unnest(v_ids) with ordinality as u(qid, ord)
      left join responses r
             on r.attempt_id = p_attempt_id and r.question_id = u.qid
  );
end $function$;

grant execute on function public.attempt_review(uuid) to authenticated;
