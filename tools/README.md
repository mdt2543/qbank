# Adding question banks

How to turn Word documents into banks on the site. All generated files go in `temp\`
(ignored by Git, so question text and pictures can never be committed by accident).

You run the Supabase commands yourself; run them from the project folder in PowerShell.
Log in first with `npx supabase login` (and `npx supabase logout` when you are done).

## Add one bank

1. **Convert it.** The title is the file name without `.docx`.

   ```powershell
   python tools\qbank_import.py "<path to the .docx>" --bank "<title>" --balance --case 9 --outdir temp\case-9 --image-root temp\case-9\images
   ```

   - `--case N` puts the bank in Case Review, subfolder "Case N". `--exam N` (1-6) puts it in Exam Prep, subfolder "Exam N". (`--folder exam-prep` alone files it directly in Exam Prep.) The bulk importer picks these up from document names starting "Case N" or "Exam N".
   - `--draft` imports the bank hidden, so you can look at it before students can.
   - Keep `--image-root`: long titles make long paths and Windows stops at about 260 characters.
   - Many banks at once: `python tools\bulk_import.py "<folder holding the Upload... folders>"`.

2. **Check it.** The importer should report no problems. For a new case number, make the
   objective list once (it only adds) and run it:

   ```powershell
   python tools\case_map.py "<Case N Learning Objectives.xlsx>" --out migrations\migration_cases_data_caseN.sql
   npx supabase db query --linked -f "migrations\migration_cases_data_caseN.sql"
   ```

   Add `--sessions-out migrations\migration_case_sessions.sql` (pass ALL case files) to also
   record which session each objective belongs to, then run that file. This is what the
   Performance "By case" session dropdowns use.

   Use the reworded spreadsheet, not the "(BACKUP original)" one. Case titles are kept
   generic on purpose: the tool drops patient names.

3. **Upload the pictures** (one command per bank, using its own folder, never the `images`
   folder itself):

   ```powershell
   npx supabase storage cp -r "temp\case-9\images\<bank slug>" ss:///qbank-images --linked --experimental
   ```

4. **Add the bank:**

   ```powershell
   npx supabase db query --linked -f "temp\case-9\<bank slug>.seed.sql"
   ```

A new bank is visible to students straight away.

## Replace a bank that is already on the site

Use the same title as the bank on the site (the slug is made from it), and add `--replace`:

```powershell
python tools\qbank_import.py "<new .docx>" --bank "<same title>" --balance --case 7 --outdir temp\case-7 --image-root temp\case-7\images
```

The SQL it writes matches questions to the bank on the site **by question number**. A question
whose stem and options (text and which one is correct) are identical keeps every student's
answers and history; explanations are refreshed in place. A question that changed, and any
question dropped from the document, loses its answers. Added questions are simply new.
Attempts, and their other answers, are kept. Upload the pictures (step 3 above) and run the
SQL (step 4) as usual. Pictures are not compared, so swapping a picture alone keeps the answers.

Without `--replace`, the file is a plain upsert: answers stay attached by number even where the
question changed, which is why `--replace` exists. To remove a bank completely instead, delete
it first (this also deletes every student's attempts and answers on it):

```powershell
npx supabase storage rm -r ss:///qbank-images/<bank slug> --linked --experimental --yes
```

(plus the delete SQL: responses, attempts, question_status, choices, questions, then the bank,
all in one transaction. Ask Claude to write it for the bank you name.)

## Hide or show banks

```powershell
npx supabase db query --linked "update public.qbanks set is_published = false where slug = '<bank slug>'"
```

Use `true` to show it again. Nothing is deleted; students' answers keep counting.

## Fix picture captions on a bank already uploaded

Citation lines under pictures ("Image: ... CC BY-SA 4.0") become small italic captions.
For banks uploaded before that existed, `--captions-only` writes SQL that only fixes the
captions and question text, and touches no options or student answers.

## Things never to do

- Never run `supabase config push` (it can switch public sign-ups back on).
- Never upload the `images` folder itself.
- Never run a delete command you have not read.
