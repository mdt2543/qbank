-- Timed exam mode: 90 seconds per question, auto-submitted when time runs out.
-- Additive: students using tutor or (untimed) exam mode are unaffected.
-- Run in the Supabase SQL Editor BEFORE deploying the matching app update.
--
-- Existing exam mode is stored as 'timed' (and already carries a time limit
-- value, so it cannot be told apart from a real timed exam). The timed exam
-- therefore gets its own mode value. resume_attempt only resumes
-- 'tutor' and 'timed', so 'timed_exam' attempts are never resumable.

alter type attempt_mode add value if not exists 'timed_exam';

-- start_attempt: unchanged except that timed_exam also gets a 90s/question limit.
create or replace function public.start_attempt(p_qbank_slug text, p_mode attempt_mode default 'tutor'::attempt_mode, p_count integer default null::integer, p_filter text default 'all'::text, p_topic_ids uuid[] default null::uuid[])
 returns uuid
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_user  uuid := auth.uid();
  v_bank  uuid;
  v_ids   uuid[];
begin
  if v_user is null then raise exception 'Not authenticated'; end if;

  select id into v_bank from qbanks
   where slug = p_qbank_slug and is_published
     and (available_at is null or available_at <= now());
  if v_bank is null then raise exception 'Qbank % not available', p_qbank_slug; end if;

  select array_agg(q.id order by random()) into v_ids
    from questions q
    left join question_status s
           on s.question_id = q.id and s.user_id = v_user
   where q.qbank_id = v_bank
     and not q.is_retired
     and (p_topic_ids is null or q.topic_id = any(p_topic_ids))
     and (
       p_filter = 'all'
       or (p_filter = 'unused'    and (s.times_seen is null or s.times_seen = 0))
       or (p_filter = 'incorrect' and s.last_result = 'incorrect')
       or (p_filter = 'marked'    and s.is_marked)
     );

  if v_ids is null or array_length(v_ids, 1) is null then
    raise exception 'No questions match that selection';
  end if;

  if p_count is not null and p_count < array_length(v_ids, 1) then
    v_ids := v_ids[1:p_count];
  end if;

  insert into attempts (user_id, qbank_id, mode, question_ids, time_limit_seconds)
  values (v_user, v_bank, p_mode, v_ids,
          case when p_mode::text in ('timed', 'timed_exam')
               then array_length(v_ids, 1) * 90 else null end)
  returning id into v_bank;

  return v_bank;
end $function$;

-- answer_question: timed_exam never reveals answers, and answers are refused
-- once the time limit has passed (plus a 15 second grace for load time/latency).
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

  if v_mode::text = 'timed_exam' and exists (
       select 1 from attempts
        where id = p_attempt_id
          and time_limit_seconds is not null
          and now() > started_at + make_interval(secs => time_limit_seconds + 15)) then
    raise exception 'Time is up';
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

  if v_mode::text in ('timed', 'timed_exam') then
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
