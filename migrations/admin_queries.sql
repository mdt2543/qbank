-- Admin queries for display names / pictures. NOT a migration: run these one at a
-- time in the Supabase SQL Editor when you need them.

-- 1. Who is behind a display name? (the leaderboard only shows names)
select p.display_name, u.email, u.last_sign_in_at, u.banned_until
  from student_profiles p
  join auth.users u on u.id = p.user_id
 where p.display_name ilike '%part of the name%'
 order by lower(p.display_name);

-- 2. Everyone with a display name, newest changes first.
select p.display_name, u.email, p.avatar_path is not null as has_picture, p.updated_at
  from student_profiles p
  join auth.users u on u.id = p.user_id
 order by p.updated_at desc;

-- 3. Ban a student. This also removes them from the leaderboard automatically.
--    (Easier in the dashboard: Authentication > Users > the user's menu > Ban user.)
--    A ban takes effect when their current login expires, usually within an hour.
-- update auth.users set banned_until = 'infinity' where email = 'student@example.edu';

-- 4. Undo a ban.
-- update auth.users set banned_until = null where email = 'student@example.edu';

-- 5. Remove an inappropriate name and/or picture without banning. The student
--    can set a new one afterwards. (The picture file itself can be deleted in
--    Storage > avatars > the user's folder.)
-- update student_profiles set display_name = null where display_name = 'Offending Name';
-- update student_profiles set avatar_path = null
--  where user_id = (select id from auth.users where email = 'student@example.edu');
