-- READ ONLY. Row count of every table, to compare with the backup.
select 'announcement_dismissals' as t, count(*) from announcement_dismissals union all
select 'announcements', count(*) from announcements union all
select 'attempts', count(*) from attempts union all
select 'case_objectives', count(*) from case_objectives union all
select 'cases', count(*) from cases union all
select 'choices', count(*) from choices union all
select 'feedback', count(*) from feedback union all
select 'profiles', count(*) from profiles union all
select 'qbanks', count(*) from qbanks union all
select 'question_status', count(*) from question_status union all
select 'questions', count(*) from questions union all
select 'responses', count(*) from responses union all
select 'site_admins', count(*) from site_admins union all
select 'student_profiles', count(*) from student_profiles union all
select 'topics', count(*) from topics union all
select 'tutorial_seen', count(*) from tutorial_seen
order by 1;
