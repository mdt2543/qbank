-- Student feedback, visible only on the admin page. Additive: one new table and
-- two new functions. Run in the Supabase SQL Editor BEFORE deploying the matching
-- app update (if the app goes first, sending feedback just shows an error).

create table if not exists public.feedback (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  -- If a bank is ever deleted and re-imported, its feedback is kept: the title
  -- is saved alongside so it still reads sensibly.
  qbank_id    uuid references public.qbanks(id) on delete set null,
  qbank_title text not null,
  attempt_id  uuid references public.attempts(id) on delete set null,
  rating      smallint check (rating between 1 and 5),
  message     text not null check (char_length(btrim(message)) between 1 and 2000),
  created_at  timestamptz not null default now()
);

create index if not exists feedback_created_at_idx on public.feedback (created_at desc);

-- No direct access for anyone; feedback goes in through submit_feedback() and
-- comes out through admin_feedback() (admins only).
alter table public.feedback enable row level security;
revoke all on public.feedback from anon, authenticated;

create or replace function public.submit_feedback(
  p_qbank_slug text,
  p_message    text,
  p_rating     smallint default null,
  p_attempt_id uuid default null)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_user  uuid := auth.uid();
  v_bank  uuid;
  v_title text;
  v_msg   text := btrim(coalesce(p_message, ''));
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if char_length(v_msg) = 0 then raise exception 'Please write a message'; end if;
  if char_length(v_msg) > 2000 then raise exception 'Please keep feedback under 2000 characters'; end if;
  if p_rating is not null and p_rating not between 1 and 5 then
    raise exception 'Rating must be 1 to 5';
  end if;

  select id, title into v_bank, v_title from qbanks where slug = p_qbank_slug;
  if v_bank is null then raise exception 'Unknown question bank'; end if;

  if p_attempt_id is not null and not exists (
       select 1 from attempts where id = p_attempt_id and user_id = v_user) then
    raise exception 'Unknown session';
  end if;

  -- simple spam guard
  if (select count(*) from feedback
       where user_id = v_user and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'You have sent a lot of feedback recently. Please try again later.';
  end if;

  insert into feedback (user_id, qbank_id, qbank_title, attempt_id, rating, message)
  values (v_user, v_bank, v_title, p_attempt_id, p_rating, v_msg);
end $function$;

-- All feedback, newest first. Returns nothing unless the caller is an admin.
create or replace function public.admin_feedback()
 returns table (id uuid, created_at timestamptz, email text, display_name text,
                bank text, bank_slug text, rating smallint, message text,
                session_mode text, session_correct integer, session_total integer)
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select f.id,
         f.created_at,
         u.email::text,
         sp.display_name,
         f.qbank_title,
         b.slug,
         f.rating,
         f.message,
         a.mode::text,
         a.score_correct,
         a.score_total
    from feedback f
    join auth.users u on u.id = f.user_id
    left join student_profiles sp on sp.user_id = f.user_id
    left join qbanks b on b.id = f.qbank_id
    left join attempts a on a.id = f.attempt_id
   where public.is_site_admin()
   order by f.created_at desc;
$function$;

revoke all on function public.submit_feedback(text, text, smallint, uuid) from public, anon;
revoke all on function public.admin_feedback() from public, anon;
grant execute on function public.submit_feedback(text, text, smallint, uuid) to authenticated;
grant execute on function public.admin_feedback() to authenticated;
