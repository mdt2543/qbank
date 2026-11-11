-- Case Review subfolders now go up to Case 16 (was 14). Only widens the allowed values; no bank
-- moves and no student data is touched. Safe to re-run.

alter table public.qbanks drop constraint if exists qbanks_subfolder_check;
alter table public.qbanks add constraint qbanks_subfolder_check
  check (subfolder is null
         or (folder = 'case-review' and subfolder ~ '^case-(1[0-6]|[1-9])$')
         or (folder = 'exam-prep'   and subfolder ~ '^exam-[1-6]$'));
