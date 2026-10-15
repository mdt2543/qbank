-- Subfolders inside Case Review ("Case 1" ... "Case 14"). Additive: one new nullable
-- column. Run in the Supabase SQL Editor BEFORE deploying the matching app update (if the
-- app goes first, banks just stay directly inside Case Review).
--
-- A bank's subfolder is 'case-1' ... 'case-14' and is only allowed on Case Review banks.
-- NULL means "directly in the folder, not in a subfolder".

alter table public.qbanks add column if not exists subfolder text;

alter table public.qbanks drop constraint if exists qbanks_subfolder_check;
alter table public.qbanks add constraint qbanks_subfolder_check
  check (subfolder is null
         or (folder = 'case-review' and subfolder ~ '^case-(1[0-4]|[1-9])$'));

-- Put a bank in a subfolder (run once per bank, after the bank itself is uploaded):
--   update public.qbanks set subfolder = 'case-8' where slug = 'case-8-review-questions';
-- See where everything is:
--   select slug, title, folder, subfolder from public.qbanks order by created_at;
