#!/usr/bin/env python3
"""
qbank_import.py — import a Qbank written in the standard format.

    python tools\\qbank_import.py "path\\to\\bank.docx" --bank "Hand, Wrist & Forearm"

Produces, next to the document (or in --outdir):
    <slug>.seed.sql          paste into the Supabase SQL Editor
    <slug>-images\\          upload these to the qbank-images bucket FIRST

This importer is deliberately strict. If the document doesn't match the
format below exactly, it lists every problem and writes nothing. It never
guesses — a bank either imports correctly or not at all.

THE FORMAT
----------
    Question 1 – Any title you like
    Stem text (one or more paragraphs).
    [optional image — belongs to the question it sits inside]
    A) First option
    B) Second option
    ...

    Answer Key                     <- a line reading exactly "Answer Key"

    Question 1: A) First option    <- letter, then the option text restated
    A) Correct: why A is right
    B) Incorrect: why B is wrong
    ...                            <- one line per option
    Objective: 2845: Objective text (Instructor)

Requires:  pip install python-docx
"""

import argparse
import collections
import pathlib
import random
import re
import sys

RE_QHEAD = re.compile(r"^Question\s+(\d{1,3})\s*(?:[\u2013\u2014\-:]\s*(.*))?$", re.I)
RE_CHOICE = re.compile(r"^([A-J])\)\s+(.+)$")
RE_KEYSEC = re.compile(r"^answer\s+key\b", re.I)
RE_KEYHEAD = re.compile(r"^Question\s+(\d{1,3})\s*:\s*([A-J])\)\s*(.*)$", re.I)
RE_RATIONALE = re.compile(r"^([A-J])\)\s*(Correct|Incorrect)\s*[:\-\u2013\u2014]\s*(.+)$", re.I)
RE_OBJECTIVE = re.compile(r"^Objective\s*:\s*([\d][\d\-]*)\s*[:\-\u2013\u2014]?\s*(.*)$", re.I)


def norm(s):
    return re.sub(r"\s+", " ", s or "").strip().lower().rstrip(".")


def slugify(t):
    return re.sub(r"[^a-z0-9]+", "-", (t or "").lower()).strip("-") or "qbank"


def esc(t):
    if t is None or t == "":
        return "NULL"
    return "'" + str(t).replace("'", "''") + "'"


# --------------------------------------------------------------------------
# read the document in true order, keeping images where they sit
# --------------------------------------------------------------------------

def read_blocks(path):
    try:
        import docx
        from docx.table import Table
        from docx.text.paragraph import Paragraph
        from docx.oxml.ns import qn
    except ImportError:
        sys.exit("This needs python-docx:  python -m pip install python-docx")

    doc = docx.Document(str(path))
    rels = doc.part.rels
    blocks = []  # ("text", str) | ("image", (ext, bytes))
    for child in doc.element.body.iterchildren():
        tag = child.tag.split("}")[-1]
        if tag == "p":
            for blip in child.findall(".//" + qn("a:blip")):
                rid = blip.get(qn("r:embed"))
                if rid in rels:
                    part = rels[rid].target_part
                    ext = pathlib.PurePosixPath(part.partname).suffix or ".png"
                    blocks.append(("image", (ext, part.blob)))
            text = Paragraph(child, doc).text.strip()
            if text:
                blocks.append(("text", text))
        elif tag == "tbl":
            for row in Table(child, doc).rows:
                for cell in row.cells:
                    for line in cell.text.splitlines():
                        if line.strip():
                            blocks.append(("text", line.strip()))
    return blocks


# --------------------------------------------------------------------------
# parse
# --------------------------------------------------------------------------

def parse(blocks):
    errors = []
    questions = collections.OrderedDict()
    keys = {}
    phase = "preamble"
    q = None      # current question
    k = None      # current key entry
    last_rat = None

    for kind, val in blocks:
        if kind == "image":
            if phase != "questions" or q is None:
                errors.append("An image appears outside any question — it has "
                              "nothing to attach to.")
                continue
            q["images"].append(val)
            continue

        text = val

        if RE_KEYSEC.match(text) and len(text) < 40:
            phase = "key"
            q = None
            continue

        if phase in ("preamble", "questions"):
            m = RE_QHEAD.match(text)
            if m and not RE_KEYHEAD.match(text):
                n = int(m.group(1))
                if n in questions:
                    errors.append(f"Question {n} appears twice in the questions section.")
                q = {"num": n, "title": (m.group(2) or "").strip(), "stem": [],
                     "choices": collections.OrderedDict(), "images": []}
                questions[n] = q
                phase = "questions"
                continue
            if phase == "preamble" or q is None:
                continue
            m = RE_CHOICE.match(text)
            if m:
                q["choices"][m.group(1)] = m.group(2).strip()
                continue
            if q["choices"]:
                last = next(reversed(q["choices"]))
                errors.append(f"Question {q['num']}: unexpected text after option "
                              f"{last}) — {text[:60]!r}")
            else:
                q["stem"].append(text)
            continue

        # ---- answer key ----
        m = RE_KEYHEAD.match(text)
        if m:
            n = int(m.group(1))
            if n in keys:
                errors.append(f"Question {n} appears twice in the answer key.")
            k = {"letter": m.group(2).upper(), "restated": m.group(3).strip(),
                 "rationales": {}, "verdicts": {}, "objective": None}
            keys[n] = k
            last_rat = None
            continue
        if k is None:
            continue
        m = RE_RATIONALE.match(text)
        if m:
            letter = m.group(1).upper()
            k["verdicts"][letter] = m.group(2).lower()
            k["rationales"][letter] = m.group(3).strip()
            last_rat = letter
            continue
        m = RE_OBJECTIVE.match(text)
        if m:
            k["objective"] = (m.group(1), m.group(2).strip())
            last_rat = None
            continue
        if last_rat:
            k["rationales"][last_rat] += " " + text  # wrapped continuation
        else:
            errors.append(f"Answer key: unrecognised line — {text[:70]!r}")

    return questions, keys, errors


# --------------------------------------------------------------------------
# validate
# --------------------------------------------------------------------------

def validate(questions, keys, errors):
    warnings = []
    if not questions:
        errors.append("No questions found. Each should start with 'Question 1 – Title'.")
        return warnings
    if not keys:
        errors.append("No answer key found. It must follow a line reading 'Answer Key'.")

    nums = sorted(questions)
    expected = list(range(1, len(nums) + 1))
    if nums != expected:
        errors.append(f"Question numbers are not 1..{len(nums)} in sequence: {nums}")

    for n in sorted(set(keys) - set(questions)):
        errors.append(f"Answer key has Question {n}, but there is no such question.")

    for n, q in questions.items():
        tag = f"Question {n}"
        if not q["stem"]:
            errors.append(f"{tag}: no stem text.")
        letters = list(q["choices"])
        if len(letters) < 2:
            errors.append(f"{tag}: found {len(letters)} options; need at least 2.")
        elif letters != [chr(65 + i) for i in range(len(letters))]:
            errors.append(f"{tag}: options are not lettered A, B, C… in order ({letters}).")
        if len(q["images"]) > 1:
            errors.append(f"{tag}: has {len(q['images'])} images; one per question is supported.")

        k = keys.get(n)
        if not k:
            errors.append(f"{tag}: missing from the answer key.")
            continue
        if k["letter"] not in q["choices"]:
            errors.append(f"{tag}: key is {k['letter']}) but the question has no option {k['letter']}.")
            continue
        if k["restated"] and norm(k["restated"])[:60] != norm(q["choices"][k["letter"]])[:60]:
            errors.append(
                f"{tag}: key says {k['letter']}) but the restated answer doesn't match that option.\n"
                f"        option {k['letter']}): {q['choices'][k['letter']][:70]}\n"
                f"        key says : {k['restated'][:70]}")
        missing = [L for L in letters if L not in k["rationales"]]
        if missing:
            errors.append(f"{tag}: no explanation for option(s) {', '.join(missing)}.")
        corrects = [L for L, v in k["verdicts"].items() if v == "correct"]
        if corrects != [k["letter"]]:
            errors.append(f"{tag}: key is {k['letter']}) but explanations mark "
                          f"{corrects or 'nothing'} as Correct.")
        if not k["objective"]:
            warnings.append(f"{tag}: no Objective line.")

    return warnings


# --------------------------------------------------------------------------
# optional: even out answer positions
# --------------------------------------------------------------------------

def balance(questions, keys, seed):
    rng = random.Random(seed)
    order = list(questions)
    by_size = collections.defaultdict(list)
    for n in order:
        by_size[len(questions[n]["choices"])].append(n)
    for size, group in by_size.items():
        slots = [chr(65 + i) for i in range(size)]
        targets = (slots * (len(group) // size + 1))[:len(group)]
        rng.shuffle(targets)
        for n, target in zip(group, targets):
            q, k = questions[n], keys[n]
            pairs = [(L, q["choices"][L], k["rationales"][L]) for L in q["choices"]]
            right = next(p for p in pairs if p[0] == k["letter"])
            others = [p for p in pairs if p[0] != k["letter"]]
            rng.shuffle(others)
            it = iter(others)
            new = [right if L == target else next(it) for L in slots]
            q["choices"] = collections.OrderedDict((L, p[1]) for L, p in zip(slots, new))
            k["rationales"] = {L: p[2] for L, p in zip(slots, new)}
            k["letter"] = target


# --------------------------------------------------------------------------
# output
# --------------------------------------------------------------------------

def write_outputs(questions, keys, bank, slug, outdir, draft):
    imgdir = outdir / f"{slug}-images"
    image_names = {}
    for n, q in questions.items():
        if q["images"]:
            ext, blob = q["images"][0]
            name = f"{slug}-q{n:02d}{ext}"
            imgdir.mkdir(parents=True, exist_ok=True)
            (imgdir / name).write_bytes(blob)
            image_names[n] = name

    topics = {}
    descriptions = {}
    for n in questions:
        obj = keys[n]["objective"]
        topics[n] = f"Objective {obj[0]}" if obj else "General"
        if obj and obj[1]:
            descriptions.setdefault(topics[n], obj[1])

    refs = [f"{slug}-q{n:03d}" for n in questions]
    out = [
        f"-- {bank} — generated by qbank_import.py",
        "-- Upload the images folder to the qbank-images bucket BEFORE running this.",
        "-- Safe to re-run: it mirrors the document exactly.",
        "begin;",
        "",
        "insert into qbanks (slug, title, is_published)",
        f"values ({esc(slug)}, {esc(bank)}, {'false' if draft else 'true'})",
        "on conflict (slug) do update set title = excluded.title,"
        " is_published = excluded.is_published;",
        "",
    ]
    for t in sorted(set(topics.values())):
        out.append(
            f"insert into topics (name, description) values ({esc(t)}, {esc(descriptions.get(t))}) "
            "on conflict (name) do update set "
            "description = coalesce(excluded.description, topics.description);")
    out.append("")
    out.append("-- remove questions no longer in the document")
    out.append("delete from questions where qbank_id = "
               f"(select id from qbanks where slug = {esc(slug)})")
    out.append("  and external_ref not in (" + ", ".join(esc(r) for r in refs) + ");")
    out.append("")

    for n, q in questions.items():
        k = keys[n]
        ref = f"{slug}-q{n:03d}"
        stem = "\n\n".join(q["stem"])
        out += [
            f"-- Question {n}" + (f" — {q['title']}" if q["title"] else ""),
            "insert into questions (external_ref, qbank_id, topic_id, stem, explanation,",
            "                       image_path, image_caption)",
            f"values ({esc(ref)},",
            f"        (select id from qbanks where slug = {esc(slug)}),",
            f"        (select id from topics where name = {esc(topics[n])}),",
            f"        {esc(stem)}, NULL, {esc(image_names.get(n))}, NULL)",
            "on conflict (external_ref) do update set",
            "  qbank_id = excluded.qbank_id, topic_id = excluded.topic_id,",
            "  stem = excluded.stem, explanation = excluded.explanation,",
            "  image_path = excluded.image_path, image_caption = excluded.image_caption;",
            f"delete from choices where question_id = (select id from questions where external_ref = {esc(ref)});",
        ]
        for L, body in q["choices"].items():
            out.append(
                "insert into choices (question_id, label, body, is_correct, rationale) values "
                f"((select id from questions where external_ref = {esc(ref)}), {esc(L)}, "
                f"{esc(body)}, {'true' if L == k['letter'] else 'false'}, {esc(k['rationales'][L])});")
        out.append("")
    out.append("commit;")

    sql_path = outdir / f"{slug}.seed.sql"
    sql_path.write_text("\n".join(out) + "\n", encoding="utf-8")
    return sql_path, imgdir, image_names


# --------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("input", help="the .docx Qbank")
    ap.add_argument("--bank", required=True, help='display title, e.g. "Hand, Wrist & Forearm"')
    ap.add_argument("--outdir", help="where to write outputs (default: beside the document)")
    ap.add_argument("--balance", action="store_true",
                    help="reorder options so correct answers spread evenly across A–E")
    ap.add_argument("--draft", action="store_true",
                    help="import unpublished, so it doesn't appear on the site yet")
    ap.add_argument("--seed", type=int, default=20260913)
    args = ap.parse_args()

    src = pathlib.Path(args.input)
    if not src.exists():
        sys.exit(f"File not found: {src}")
    outdir = pathlib.Path(args.outdir) if args.outdir else src.parent
    slug = slugify(args.bank)

    questions, keys, errors = parse(read_blocks(src))
    warnings = validate(questions, keys, errors)

    print(f"\n{src.name}", file=sys.stderr)
    print(f"  {len(questions)} questions, {sum(1 for q in questions.values() if q['images'])} with images",
          file=sys.stderr)

    if errors:
        print(f"\nNOT IMPORTED — {len(errors)} problem(s). Fix the document and re-run:\n",
              file=sys.stderr)
        for e in errors:
            print(f"  ✗ {e}", file=sys.stderr)
        sys.exit(1)

    before = collections.Counter(keys[n]["letter"] for n in questions)
    if args.balance:
        balance(questions, keys, args.seed)
    after = collections.Counter(keys[n]["letter"] for n in questions)

    outdir.mkdir(parents=True, exist_ok=True)
    sql_path, imgdir, image_names = write_outputs(questions, keys, args.bank, slug, outdir, args.draft)

    letters = sorted({L for q in questions.values() for L in q["choices"]})
    dist = "  ".join(f"{L}={after.get(L, 0)}" for L in letters)
    print(f"  answer positions: {dist}" + ("  (balanced)" if args.balance else ""), file=sys.stderr)
    objs = {keys[n]["objective"][0] for n in questions if keys[n]["objective"]}
    print(f"  objectives: {len(objs)}", file=sys.stderr)
    if image_names:
        print("  images: " + ", ".join(f"Q{n}" for n in image_names), file=sys.stderr)

    if not args.balance:
        top, count = before.most_common(1)[0]
        if count / len(questions) > 0.4 or len(before) <= len(letters) // 2:
            warnings.append(
                f"Correct answers only use {', '.join(sorted(before))} "
                f"({dict(sorted(before.items()))}). Consider --balance.")
    for w in warnings:
        print(f"  ! {w}", file=sys.stderr)

    print(f"\nwrote {sql_path}", file=sys.stderr)
    if image_names:
        print(f"wrote {len(image_names)} image(s) to {imgdir}", file=sys.stderr)
        print("\nNext: upload the images, THEN run the SQL.", file=sys.stderr)
    else:
        print("\nNext: run the SQL.", file=sys.stderr)


if __name__ == "__main__":
    main()