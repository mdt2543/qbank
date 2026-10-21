-- Performance, By case: a section (question bank) layer between each case and its objectives.
-- Additive: one new view. Nothing existing is changed and no student data is touched.
-- Run in the Supabase SQL Editor (or `npx supabase db query --linked -f`) BEFORE deploying
-- the matching app update.
--
-- One row per case / question bank / objective the student has answered at least once.
-- Same all-attempts and "latest" columns as the other v_perf_* views. Published banks only.

create or replace view public.v_perf_case_bank_objective as
  select c.number as case_number,
         b.slug,
         b.title as bank,
         b.created_at as bank_created_at,
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
   group by c.number, b.id, b.slug, b.title, b.created_at, t.name, t.description;

grant select on public.v_perf_case_bank_objective to authenticated;
