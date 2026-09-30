-- Exam mode. Uses the existing 'timed' attempt_mode as the non-revealing mode
-- (the app ignores time_limit_seconds; there is no timer).
-- Run in the Supabase SQL Editor BEFORE deploying.

-- 1. answer_question: an answer changed within the same attempt no longer
--    counts as another "seen", and times_correct follows the latest answer.
create or replace function public.answer_question(p_attempt_id uuid, p_question_id uuid, p_choice_id uuid, p_seconds integer default null::integer)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_user     uuid := auth.uid();
  v_mode     attempt_mode;
  v_correct  uuid;
  v_hit      boolean;
  v_had      boolean;
  v_prev_hit boolean;
begin
  select mode into v_mode from attempts
   where id = p_attempt_id and user_id = v_user and status = 'in_progress';
  if v_mode is null then raise exception 'No active attempt'; end if;

  if not exists (select 1 from attempts
                  where id = p_attempt_id and p_question_id = any(question_ids)) then
    raise exception 'Question is not part of this attempt';
  end if;

  select id into v_correct from choices
   where question_id = p_question_id and is_correct;
  v_hit := (p_choice_id is not null and p_choice_id = v_correct);

  select is_correct into v_prev_hit from responses
   where attempt_id = p_attempt_id and question_id = p_question_id;
  v_had := found;

  insert into responses (attempt_id, question_id, selected_choice_id,
                         is_correct, seconds_spent, answered_at)
  values (p_attempt_id, p_question_id, p_choice_id, v_hit, p_seconds, now())
  on conflict (attempt_id, question_id) do update set
    selected_choice_id = excluded.selected_choice_id,
    is_correct         = excluded.is_correct,
    seconds_spent      = excluded.seconds_spent,
    answered_at        = excluded.answered_at;

  insert into question_status (user_id, question_id, last_result,
                               times_seen, times_correct, updated_at)
  values (v_user, p_question_id,
          case when v_hit then 'correct' else 'incorrect' end::question_result,
          1, case when v_hit then 1 else 0 end, now())
  on conflict (user_id, question_id) do update set
    last_result   = excluded.last_result,
    times_seen    = question_status.times_seen + (case when v_had then 0 else 1 end),
    times_correct = question_status.times_correct
                    + (case when v_hit then 1 else 0 end)
                    - (case when v_had and v_prev_hit then 1 else 0 end),
    updated_at    = now();

  if v_mode = 'timed' then
    return jsonb_build_object('recorded', true, 'reveal', false);
  end if;

  return jsonb_build_object(
    'recorded', true,
    'reveal', true,
    'is_correct', v_hit,
    'correct_choice_id', v_correct,
    'explanation', (select explanation from questions where id = p_question_id),
    'rationales', (select jsonb_object_agg(id, rationale)
                     from choices where question_id = p_question_id)
  );
end $function$;

-- 2. attempt_review: answers + explanations, only after the attempt is submitted.
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
                                      from choices c where c.question_id = u.qid)
           ) order by u.ord), '[]'::jsonb)
      from unnest(v_ids) with ordinality as u(qid, ord)
      left join responses r
             on r.attempt_id = p_attempt_id and r.question_id = u.qid
  );
end $function$;

grant execute on function public.attempt_review(uuid) to authenticated;
