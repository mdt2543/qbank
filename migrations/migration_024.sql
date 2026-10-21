-- Subfolders inside Exam Prep ("Exam 1" ... "Exam 6"), the same way Case Review has Case 1-14.
-- Run BEFORE deploying the matching app update (until then banks just stay directly inside
-- Exam Prep). No student data is touched: this only changes which folder a bank is shown in.
--
-- A bank's subfolder is 'case-1' ... 'case-14' (Case Review) or 'exam-1' ... 'exam-6' (Exam Prep).

alter table public.qbanks drop constraint if exists qbanks_subfolder_check;
alter table public.qbanks add constraint qbanks_subfolder_check
  check (subfolder is null
         or (folder = 'case-review' and subfolder ~ '^case-(1[0-4]|[1-9])$')
         or (folder = 'exam-prep'   and subfolder ~ '^exam-[1-6]$'));

-- File the Exam Prep banks that are already on the site by their title ("Exam 4 Practice ...").
update public.qbanks
   set subfolder = 'exam-' || substring(title from '^\s*[Ee]xam\s*([1-6])\y')
 where folder = 'exam-prep'
   and subfolder is null
   and title ~* '^\s*exam\s*[1-6]\y';

-- Check: every Exam Prep bank and where it ended up (a blank subfolder means the title
-- didn't start with "Exam N" and it needs filing by hand).
select slug, title, subfolder from public.qbanks where folder = 'exam-prep' order by created_at;
