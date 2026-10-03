-- Resume unfinished sessions. Purely additive: nothing existing is changed.
-- Run in the Supabase SQL Editor BEFORE deploying the matching app update.
-- (If the app is deployed first, the only effect is that no Resume prompt shows.)

-- 1. Lets a student discard an unfinished session so it is never offered again.
alter table public.attempts add column if not exists abandoned_at timestamptz;

create or replace function public.abandon_attempt(p_attempt_id uuid)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  update attempts set abandoned_at = now()
   where id = p_attempt_id
     and user_id = auth.uid()
     and status = 'in_progress';
end $function$;

-- 2. The student's latest unfinished session for a bank, or null.
--    Only modes listed below can be resumed. 'tutor' is tutor mode and 'timed'
--    is what the app currently stores for (untimed) exam mode. A future
--    timed-exam mode should use a NEW mode value that is not in this list,
--    which keeps it non-resumable. Sessions older than 14 days are not offered.
create or replace function public.resume_attempt(p_qbank_slug text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_user uuid := auth.uid();
  a      record;
begin
  if v_user is null then return null; end if;

  select t.id, t.mode::text as mode, t.question_ids, t.started_at
    into a
    from attempts t
    join qbanks b on b.id = t.qbank_id
   where t.user_id = v_user
     and b.slug = p_qbank_slug
     and t.status = 'in_progress'
     and t.abandoned_at is null
     and t.mode::text in ('tutor', 'timed')
     and t.started_at > now() - interval '14 days'
     and exists (select 1 from responses r where r.attempt_id = t.id)
   order by t.started_at desc
   limit 1;

  if not found then return null; end if;

  return jsonb_build_object(
    'attempt_id',   a.id,
    'mode',         a.mode,
    'question_ids', to_jsonb(a.question_ids),
    'started_at',   a.started_at,
    'responses',    coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'question_id',        r.question_id,
                 'selected_choice_id', r.selected_choice_id)
               -- Answers are revealed only in tutor mode, and only for
               -- questions the student has already answered.
               || case when a.mode = 'tutor' then jsonb_build_object(
                    'is_correct',        r.is_correct,
                    'correct_choice_id', (select c.id from choices c
                                           where c.question_id = r.question_id and c.is_correct),
                    'explanation',       (select explanation from questions where id = r.question_id),
                    'rationales',        (select jsonb_object_agg(c.id, c.rationale)
                                            from choices c where c.question_id = r.question_id))
                  else '{}'::jsonb end)
        from responses r
       where r.attempt_id = a.id
    ), '[]'::jsonb)
  );
end $function$;

grant execute on function public.abandon_attempt(uuid) to authenticated;
grant execute on function public.resume_attempt(text) to authenticated;
