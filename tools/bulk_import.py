#!/usr/bin/env python3
"""
bulk_import.py — convert many Qbank documents at once.

    python tools\\bulk_import.py "C:\\path\\to\\Session QBanks"

Looks (at any depth) inside every folder whose name starts with "Upload" and converts
each .docx there with qbank_import.py. Documents elsewhere (reference folders, drafts)
are ignored. A document named "Case 8 - Something.docx" is filed under Case Review,
subfolder "Case 8"; other documents go to --folder (or stay unfiled).

Writes, into --out (default: Bulk Upload on your Desktop):
    images\\             select EVERYTHING inside this folder and drag it into the
                        qbank-images bucket in one go (one subfolder per bank)
    sql\\00-hide-existing-banks.sql   hides every bank that is not in this batch
    sql\\01-banks.sql, 02-banks.sql... the banks, grouped into a few files

A document that fails validation is reported and skipped; the rest still convert.
Re-running replaces the previous output in --out.
"""

import argparse
import pathlib
import re
import shutil
import subprocess
import sys

sys.dont_write_bytecode = True
HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import qbank_import as qi  # noqa: E402  (for slugify, so slugs always match)

MARKER = ".bulk-import"


def find_documents(root, prefix):
    docs = []
    for d in sorted(p for p in root.rglob("*") if p.is_dir()):
        if d.name.lower().startswith(prefix.lower()):
            docs += sorted(f for f in d.glob("*.docx") if not f.name.startswith("~$"))
    return docs


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("root", help="folder that contains the 'Upload...' folders")
    ap.add_argument("--out", help="output folder (default: 'Bulk Upload' on the Desktop)")
    ap.add_argument("--folder", choices=["case-review", "exam-prep"],
                    help="home-page folder for documents not named 'Case N'")
    ap.add_argument("--marker", default="Upload",
                    help="only folders whose name starts with this are read (default: Upload)")
    ap.add_argument("--max-kb", type=int, default=900,
                    help="rough size limit for each combined SQL file (default 900)")
    ap.add_argument("--dry-run", action="store_true", help="list what would be done, write nothing")
    args = ap.parse_args()

    root = pathlib.Path(args.root)
    if not root.is_dir():
        sys.exit(f"Folder not found: {root}")
    docs = find_documents(root, args.marker)
    if not docs:
        sys.exit(f"No .docx files found inside folders named '{args.marker}...' under {root}")

    plan = []
    for f in docs:
        title = f.stem
        m = re.match(r"\s*Case\s*(\d{1,2})\b", title, re.I)
        case = int(m.group(1)) if m and 1 <= int(m.group(1)) <= 14 else None
        plan.append((f, title, qi.slugify(title), case))

    seen = {}
    for f, title, slug, case in plan:
        if slug in seen:
            sys.exit(f"Two documents would become the same bank ('{slug}'):\n  {seen[slug]}\n  {f}")
        seen[slug] = f

    print(f"{len(plan)} documents:\n")
    for f, title, slug, case in plan:
        where = f"Case Review > Case {case}" if case else (args.folder or "unfiled")
        print(f"  {title}\n      -> {where}")
    if args.dry_run:
        return

    out = pathlib.Path(args.out) if args.out else pathlib.Path.home() / "Desktop" / "Bulk Upload"
    if out.exists() and any(out.iterdir()) and not (out / MARKER).exists():
        sys.exit(f"{out} already exists and was not created by this tool. Choose another --out.")
    out.mkdir(parents=True, exist_ok=True)
    for sub in ("images", "sql", "w"):
        shutil.rmtree(out / sub, ignore_errors=True)
    (out / MARKER).write_text("created by bulk_import.py\n")
    (out / "images").mkdir()
    (out / "sql").mkdir()

    done, failed = [], []
    for i, (f, title, slug, case) in enumerate(plan, 1):
        # short work folders: Windows rejects paths past ~260 characters
        work = out / "w" / str(i)
        cmd = [sys.executable, str(HERE / "qbank_import.py"), str(f), "--bank", title,
               "--balance", "--outdir", str(work), "--image-root", str(out / "images")]
        if case:
            cmd += ["--case", str(case)]
        elif args.folder:
            cmd += ["--folder", args.folder]
        r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
        err = r.stderr
        if r.returncode != 0:
            failed.append((title, [l.strip() for l in err.splitlines() if "\u2717" in l or "✗" in l] or [err.strip()[-300:]]))
            continue
        warns = [l.strip() for l in err.splitlines() if l.strip().startswith("!")]
        nq = re.search(r"(\d+) questions, (\d+) with images", err)
        done.append((title, slug, work / f"{slug}.seed.sql", nq.groups() if nq else ("?", "?"), warns))

    # hide every existing bank that is not part of this batch
    if done:
        keep = ", ".join(qi.esc(slug) for _, slug, *_ in done)
        (out / "sql" / "00-hide-existing-banks.sql").write_text(
            "-- Hides every bank on the site EXCEPT the ones in this batch. Nothing is deleted:\n"
            "-- students' answers and progress are kept, and a bank can be shown again with\n"
            "--   update public.qbanks set is_published = true where slug = '...';\n"
            f"update public.qbanks set is_published = false where slug not in ({keep});\n",
            encoding="utf-8")

    # combine the bank files into a few SQL files
    parts, cur, size = [], [], 0
    limit = args.max_kb * 1024
    for title, slug, seed, *_ in done:
        text = seed.read_text(encoding="utf-8")
        if cur and size + len(text) > limit:
            parts.append(cur)
            cur, size = [], 0
        cur.append(text)
        size += len(text)
    if cur:
        parts.append(cur)
    for i, chunk in enumerate(parts, 1):
        (out / "sql" / f"{i:02d}-banks.sql").write_text("\n".join(chunk), encoding="utf-8")
    shutil.rmtree(out / "w", ignore_errors=True)

    print(f"\n=== {len(done)} converted, {len(failed)} failed ===\n")
    for title, slug, seed, (nq_, ni_), warns in done:
        print(f"  ok   {title}  ({nq_} questions, {ni_} with images)")
        for w in warns:
            print(f"         {w}")
    for title, errs in failed:
        print(f"  FAIL {title}")
        for e in errs[:8]:
            print(f"         {e}")
    if done:
        print(f"\nOutput: {out}")
        print("  1. Pictures. Either open the images folder, select everything inside and drag it into")
        print("     Supabase > Storage > qbank-images, or upload each bank folder from a terminal in the")
        print("     project folder (do NOT upload the images folder itself: it adds an extra 'images' layer):")
        print('       Get-ChildItem "<images folder>" -Directory | ForEach-Object { npx supabase storage cp -r "<relative path>\\$($_.Name)" ss:///qbank-images --linked --experimental }')
        print("  2. SQL Editor: run sql\\00-hide-existing-banks.sql")
        print(f"  3. SQL Editor: run {', '.join(f'{i:02d}-banks.sql' for i in range(1, len(parts) + 1))} (in order)")


if __name__ == "__main__":
    main()
