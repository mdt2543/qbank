-- Performance from every answer, not just each question's latest result.
-- Additive: new views only. The old v_my_*_performance views are left exactly
-- as they are, so pages students already have open keep working until they reload.
-- Run in the Supabase SQL Editor BEFORE deploying the matching app update.
--
-- Why: the old views read question_status.last_result, which keeps only the most
-- recent result per question and also holds 'omitted' for questions left blank
-- when a session was submitted. Omitted questions were being counted as wrong,
-- and a single recent answer overwrote everything before it.
--
-- Now: every answer the student actually gave (selected_choice_id is not null),
-- across all attempts, submitted or not. Skipped questions are never counted.
-- Each view also carries a "latest" set of columns (only the most recent answer
-- to each question) for the "latest attempt only" toggle.

create or replace view public.v_my_answers as
  select r.question_id,
         r.is_correct,
         r.answered_at,
         q.qbank_id,
         q.topic_id,
         (row_number() over (partition by r.question_id
                             order by r.answered_at desc) = 1) as is_latest
    from responses r
    join attempts a on a.id = r.attempt_id
    join questions q on q.id = r.question_id
   where a.user_id = auth.uid()
     and r.selected_choice_id is not null;

-- By objective
create or replace view public.v_perf_objective as
  select t.name as topic,
         t.description,
         count(*) as answered,
         count(*) filter (where m.is_correct) as correct,
         round(100.0 * count(*) filter (where m.is_correct) / nullif(count(*), 0), 1) as pct,
         count(*) filter (where m.is_latest) as latest_answered,
         count(*) filter (where m.is_latest and m.is_correct) as latest_correct,
         round(100.0 * count(*) filter (where m.is_latest and m.is_correct)
               / nullif(count(*) filter (where m.is_latest), 0), 1) as latest_pct
    from v_my_answers m
    left join topics t on t.id = m.topic_id
   group by t.name, t.description;

-- By case (a question counts toward every case its objective belongs to)
create or replace view public.v_perf_case as
  select c.number as case_number,
         c.title,
         count(*) as answered,
         count(*) filter (where m.is_correct) as correct,
         round(100.0 * count(*) filter (where m.is_correct) / nullif(count(*), 0), 1) as pct,
         count(*) filter (where m.is_latest) as latest_answered,
         count(*) filter (where m.is_latest and m.is_correct) as latest_correct,
         round(100.0 * count(*) filter (where m.is_latest and m.is_correct)
               / nullif(count(*) filter (where m.is_latest), 0), 1) as latest_pct
    from v_my_answers m
    join topics t on t.id = m.topic_id
    join case_objectives co on 'Objective ' || co.code = t.name
    join cases c on c.number = co.case_number
   group by c.number, c.title
   order by c.number;

-- The objectives inside each case
create or replace view public.v_perf_case_objective as
  select c.number as case_number,
         t.name as topic,
         t.description,
         count(*) as answered,
         count(*) filter (where m.is_correct) as correct,
         round(100.0 * count(*) filter (where m.is_correct) / nullif(count(*), 0), 1) as pct,
         count(*) filter (where m.is_latest) as latest_answered,
         count(*) filter (where m.is_latest and m.is_correct) as latest_correct,
         round(100.0 * count(*) filter (where m.is_latest and m.is_correct)
               / nullif(count(*) filter (where m.is_latest), 0), 1) as latest_pct
    from v_my_answers m
    join topics t on t.id = m.topic_id
    join case_objectives co on 'Objective ' || co.code = t.name
    join cases c on c.number = co.case_number
   group by c.number, t.name, t.description;

-- By question bank, oldest upload first
create or replace view public.v_perf_bank as
  select b.slug,
         b.title as bank,
         count(distinct m.question_id) as questions,
         (select count(*) from questions q2
           where q2.qbank_id = b.id and not q2.is_retired) as total,
         count(*) as answered,
         count(*) filter (where m.is_correct) as correct,
         round(100.0 * count(*) filter (where m.is_correct) / nullif(count(*), 0), 1) as pct,
         count(*) filter (where m.is_latest) as latest_answered,
         count(*) filter (where m.is_latest and m.is_correct) as latest_correct,
         round(100.0 * count(*) filter (where m.is_latest and m.is_correct)
               / nullif(count(*) filter (where m.is_latest), 0), 1) as latest_pct
    from v_my_answers m
    join qbanks b on b.id = m.qbank_id
   where b.is_published
   group by b.id, b.slug, b.title, b.created_at
   order by b.created_at;

grant select on public.v_my_answers to authenticated;
grant select on public.v_perf_objective to authenticated;
grant select on public.v_perf_case to authenticated;
grant select on public.v_perf_case_objective to authenticated;
grant select on public.v_perf_bank to authenticated;
