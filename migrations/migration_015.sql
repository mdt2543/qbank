-- Folders on the home page. Additive: one new nullable column. Run in the Supabase
-- SQL Editor BEFORE deploying the matching app update (if the app goes first, the
-- home page simply keeps showing the plain list).
--
-- A bank's folder is 'case-review' or 'exam-prep'. NULL means "not in a folder"; those
-- banks are shown under "Other" so nothing disappears. New banks are unfiled until
-- you assign them, or until you import them with:  --folder case-review | exam-prep

alter table public.qbanks add column if not exists folder text;

alter table public.qbanks drop constraint if exists qbanks_folder_check;
alter table public.qbanks add constraint qbanks_folder_check
  check (folder is null or folder in ('case-review', 'exam-prep'));

-- Assigning banks is a separate step (run after you've decided which bank goes where):
--   select slug, title, folder from public.qbanks order by created_at;
--   update public.qbanks set folder = 'exam-prep'   where slug in ('...', '...');
--   update public.qbanks set folder = 'case-review' where slug in ('...', '...');
