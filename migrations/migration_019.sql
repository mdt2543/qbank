-- Lets admins (and only admins) see and open banks that are hidden from students.
-- Students are not affected: every change below adds an "or the caller is an admin"
-- condition that is false for them, so they get exactly the results they got before.
-- Run BEFORE deploying the matching app update (if the app goes first, admins simply
-- do not see hidden banks yet).
--
-- Why functions: the qbanks table only lets anyone read PUBLISHED banks (row-level
-- security), so hidden banks can only be reached through functions that check admin status.

-- All banks (published or not) for the home page, admins only.
create or replace function public.admin_all_banks()
 returns table (slug text, title text, description text, is_published boolean,
                folder text, subfolder text, created_at timestamptz, question_count bigint)
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select b.slug, b.title, b.description, b.is_published, b.folder, b.subfolder, b.created_at,
         (select count(*) from questions q where q.qbank_id = b.id and not q.is_retired)
    from qbanks b
   where public.is_site_admin()
   order by b.created_at;
$function$;

-- One bank by address, published or not, admins only (for the bank's own page).
create or replace function public.admin_bank_info(p_slug text)
 returns table (slug text, title text, is_published boolean)
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select b.slug, b.title, b.is_published
    from qbanks b
   where public.is_site_admin() and b.slug = p_slug;
$function$;

-- Counts on the bank's start page: also available for hidden banks when an admin asks.
create or replace function public.qbank_counts(p_qbank_slug text)
 returns jsonb
 language sql
 security definer
 set search_path to 'public'
as $function$
  select jsonb_build_object(
    'total',     count(*),
    'unused',    count(*) filter (where s.times_seen is null or s.times_seen = 0),
    'incorrect', count(*) filter (where s.last_result = 'incorrect'),
    'marked',    count(*) filter (where s.is_marked),
    'correct',   count(*) filter (where s.last_result = 'correct')
  )
  from questions q
  join qbanks b on b.id = q.qbank_id
  left join question_status s
    on s.question_id = q.id and s.user_id = auth.uid()
  where b.slug = p_qbank_slug
    and not q.is_retired
    and (b.is_published or public.is_site_admin());
$function$;

-- Starting a session: an admin may start one on a hidden or not-yet-available bank.
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
   where slug = p_qbank_slug
     and ((is_published and (available_at is null or available_at <= now()))
          or public.is_site_admin());
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

-- The question view the session screen reads. Same columns as before; the only change is
-- that an admin also gets hidden banks' questions (v_choice follows this view).
create or replace view public.v_question as
  select q.id,
         q.qbank_id,
         q.topic_id,
         q.difficulty,
         q.stem,
         q.external_ref,
         q.image_path,
         q.image_caption
    from questions q
    join qbanks b on b.id = q.qbank_id
   where not q.is_retired
     and ((b.is_published and (b.available_at is null or b.available_at <= now()))
          or (select public.is_site_admin()));

revoke all on function public.admin_all_banks() from public, anon;
revoke all on function public.admin_bank_info(text) from public, anon;
grant execute on function public.admin_all_banks() to authenticated;
grant execute on function public.admin_bank_info(text) to authenticated;
