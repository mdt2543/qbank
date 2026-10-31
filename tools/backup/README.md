# Backing up the site

Read-only scripts (nothing on the site changes). Run each from the project folder, in this order.
Everything lands in `temp\backup\site-backup-<today>` (git-ignored). The backup holds student emails
and password hashes: keep it out of Git and off shared drives.

```powershell
powershell -ExecutionPolicy Bypass -File tools\backup\backup-tables.ps1
powershell -ExecutionPolicy Bypass -File tools\backup\backup-choices.ps1
powershell -ExecutionPolicy Bypass -File tools\backup\backup-pictures.ps1
```

1. `backup-tables.ps1`: every table as JSON (except `choices`), the login accounts, and a copy of `.env.local`.
2. `backup-choices.ps1`: the `choices` table, one bank at a time (a plain query is too big).
3. `backup-pictures.ps1`: all pictures, one bank folder at a time, retried on timeout.

Pass `-Dir "<folder>"` to any script to use a specific backup folder (use the same one for all three
when a backup spans several days). Re-running skips what is already saved.

**Check it.** A script printing "Done" is not proof. Run `tools\backup\count-tables.sql`
(`npx supabase db query --linked -f ...`) and compare each table's row count with the saved files;
any line saying FAILED or "MAY BE TRUNCATED" means that table needs another go.

Notes: the Supabase CLI here has no Docker, so `supabase db dump` is not used. Asking for a second
page of a table (`offset`) failed through the Management API, which is why large tables are split by
bank. The scripts were first run in an earlier form; these tidied copies take the folder as a
parameter and have not been run end to end yet, so check the counts the first time.
