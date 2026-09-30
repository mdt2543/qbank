-- Objective wording: stored on topics, shown in the runner and Performance page.
-- Run this in the Supabase SQL Editor BEFORE deploying and BEFORE re-importing.
alter table topics add column if not exists description text;

create or replace view v_my_topic_performance as
  select t.name as topic,
         count(*)                              as answered,
         count(*) filter (where s.last_result = 'correct') as correct,
         round(100.0 * count(*) filter (where s.last_result = 'correct')
               / nullif(count(*), 0), 1)       as pct,
         t.description                         as description
    from question_status s
    join questions q on q.id = s.question_id
    left join topics t on t.id = q.topic_id
   where s.user_id = auth.uid()
   group by t.name, t.description
   order by pct nulls last;
