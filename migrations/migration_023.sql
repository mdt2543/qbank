-- Performance, By question bank: inside each bank, the cases and sessions its questions belong to.
-- Additive: one new view. Nothing existing is changed and no student data is touched.
-- Run BEFORE deploying the matching app update (the page falls back to the plain bank list
-- until this exists).
--
-- One row per bank / case / session / objective the student has answered at least once, counting
-- only answers given in that bank. Same all-attempts and "latest" columns as the other
-- v_perf_* views. Published banks only. Objectives with no session recorded are 'Other objectives'.

create or replace view public.v_perf_bank_case_session_objective as
  select b.slug,
         c.number as case_number,
         c.title as case_title,
         coalesce(co.session_title, 'Other objectives') as session,
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
    join qbanks b on b.id = m.qbank_id
    join topics t on t.id = m.topic_id
    join case_objectives co on 'Objective ' || co.code = t.name
    join cases c on c.number = co.case_number
   where b.is_published
   group by b.id, b.slug, c.number, c.title, co.session_title, t.name, t.description;

grant select on public.v_perf_bank_case_session_objective to authenticated;
