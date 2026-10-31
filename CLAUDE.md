@AGENTS.md

# teterqbank: how we work

Next.js 16 (App Router) + Supabase question bank for students. The owner is the site admin and
adds content and features step by step. Read `tools/README.md` for the bank upload routine.

## Working agreements

- **The owner runs every Supabase command** (SQL, `storage cp/rm`, logins). Claude prepares the
  SQL/scripts, tells the owner exactly what to run, then checks the result. Never run anything
  that writes to or deletes from Supabase yourself.
- **Never run a destructive action without an explicit yes** after showing exactly what it affects
  (deleting banks, accounts, or data). Deletes re-check their own counts and run in one transaction.
  Deleting a bank also deletes every student's attempts and answers on it, so never re-upload a
  changed bank under the same title: delete first, then add.
- **Commit and push only when asked.** Add the Co-Authored-By line the session gives you.
- **Temp and generated files go in `temp\`** (git-ignored; never the Desktop, never committed):
  converted banks, seed SQL, pictures, helper scripts, backups.
- **Never touch the sign-up setting or run `supabase config push`.**
- Keep case titles generic (no patient names), and keep objective wording reworded (no faculty
  names, never the phrase "question of the day").
- When giving the owner commands: one command per code block, PowerShell, relative paths.
  Scripts that loop over files must use relative paths (`$_.Name`, not `$_.FullName`): a `C:\` path
  is misread by the Supabase CLI as a web address. Use `powershell -ExecutionPolicy Bypass -File`.
- Say plainly when something failed or was only partly done. A script printing "Done" is not proof:
  check the files or counts.

## Supabase CLI notes

- Everything goes through `--linked` (no connection string). Run `npx -y supabase --version` once
  after a CLI update, or redirected output files contain only the "install" prompt.
- Query results saved with `> file.txt` come out garbled (box characters); read them directly.
  `--output-format json` gives a plain JSON array.
- Reading big results: a second page (`offset`) of a query failed in the Management API; export in
  small queries (for example per bank) instead.
- Storage: upload each bank's own folder, never the `images` folder itself
  (`storage cp -r "temp\<dir>\images\<slug>" ss:///qbank-images --linked --experimental`). Verify every
  picture from the public address (expect 200; `images/<slug>/...` should be 400).

## Content and data model

- Banks: `qbanks.folder` is `case-review` or `exam-prep`; `subfolder` is `case-1..14` or `exam-1..6`
  (lowercase, hyphenated). `--draft` imports a bank hidden (`is_published = false`).
- Convert with `python tools/qbank_import.py ... --case N` (run WITHOUT `-I`; it breaks python-docx).
  Cross-check every objective code against the case's reworded workbook before uploading.
- Folder layout on the owner's computer (Desktop\Wellness Semester): one `Case N` folder per case with
  `Session QBanks\Upload - question files` (the question documents) and `Reference - credits and QA`.
  Reworded objective workbooks: `Exam Prep\Learning Objectives\Exam N - Case X Learning Objectives.xlsx`
  (use the file WITHOUT "BACKUP original").
- Objectives: `topics` (name `Objective <code>`, description = the reworded wording students see),
  `case_objectives (case_number, code, session_title)`; `tools/case_map.py` builds the mapping SQL.
- Performance page and admin page use views/functions defined in `migrations/` (run in order by the
  owner). Admin shows "last answered" (newest answer) and "last sign-in" (Supabase Auth); they differ.
- Themes: brand colors are CSS variables (`brand-50..950`) driven by `lib/color-themes.ts`; stored in
  `student_profiles.color_theme`.
- Class average on a bank only shows for students with jump scare mode on (enforced in the database).

## Backups

`temp\backup\` holds scripts that export every table (JSON), the login accounts, and all pictures;
they are read-only and re-runnable. Compare the saved row counts with the site's before trusting a
backup. Backups contain student emails and password hashes: keep them out of Git and off shared drives.
