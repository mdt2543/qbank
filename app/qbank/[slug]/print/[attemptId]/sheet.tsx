/* eslint-disable @next/next/no-img-element */
// The printable results of one session. Pure layout: it gets everything it needs as
// props, so it can be checked on its own. Always black on white, whatever the site theme.
//
// The page is one table: its empty <tfoot> spacer repeats at the foot of every printed page,
// keeping room for the fixed "teterqbank" footer that is pinned to the bottom of every page
// (a footer placed in the printer margin gets cut off by browsers).

export type PrintChoice = {
  id: string;
  label: string;
  body: string;
  why: string | null;
  isKey: boolean; // the correct answer
  mine: boolean; // what the student picked
};

export type PrintQuestion = {
  number: number;
  stem: string;
  imageUrl: string | null;
  caption: string | null;
  choices: PrintChoice[];
  outcome: "correct" | "incorrect" | "omitted";
  explanation: string | null;
  objective: { name: string; description: string | null } | null;
};

export type PrintData = {
  bankTitle: string;
  modeLabel: string;
  submitted: string;
  student: string;
  correct: number;
  total: number;
  questions: PrintQuestion[];
};

const css = `
  @page { margin: 12mm 14mm; }
  .print-table { width: 100%; border-collapse: collapse; }
  .print-table > tfoot { display: table-footer-group; }
  .print-table td { padding: 0; vertical-align: top; }
  .print-footer { display: none; }
  .print-spacer { height: 0; }
  @media print {
    html, body { background: #fff !important; color: #000 !important; }
    body > header { display: none !important; }
    .print-row { break-inside: avoid; page-break-inside: avoid; }
    .print-row img { max-height: 70mm; }
    /* pinned to the bottom of every printed page */
    .print-footer {
      display: block;
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      padding-top: 2mm;
      border-top: 1px solid #999;
      background: #fff;
      text-align: center;
      font-size: 9pt;
      letter-spacing: 0.15em;
      color: #555;
    }
    /* keeps room at the foot of each page so content never runs under the footer */
    .print-spacer { height: 10mm; }
    .screen-footer { display: none; }
  }
`;

const OUTCOME = {
  correct: "Correct",
  incorrect: "Incorrect",
  omitted: "Omitted (no answer given)",
} as const;

function marker(c: PrintChoice) {
  if (c.isKey && c.mine) return "✓ Your answer (correct)";
  if (c.isKey) return "✓ Correct answer";
  if (c.mine) return "✗ Your answer";
  return null;
}

export default function PrintSheet({ data }: { data: PrintData }) {
  const pct = data.total ? Math.round((100 * data.correct) / data.total) : 0;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <article className="mx-auto my-6 max-w-3xl bg-white px-10 py-8 text-black shadow print:my-0 print:max-w-none print:p-0 print:shadow-none">
        <table className="print-table">
          <tbody>
            <tr>
              <td>
                <header className="border-b-2 border-black pb-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-600">teterqbank</p>
                  <h1 className="mt-1 text-xl font-bold">{data.bankTitle}</h1>
                  <p className="mt-1 text-sm">
                    {data.modeLabel} session · {data.submitted}
                  </p>
                  <p className="text-sm">{data.student}</p>
                  <p className="mt-2 text-base font-semibold">
                    Score: {data.correct} / {data.total} ({pct}%)
                  </p>
                </header>
              </td>
            </tr>

            {data.questions.map((q) => (
              <tr key={q.number}>
                <td>
                  <section className="print-row pt-4">
                    <div className="flex items-baseline justify-between gap-4">
                      <h2 className="text-sm font-bold">Question {q.number}</h2>
                      <span className="text-xs font-semibold">{OUTCOME[q.outcome]}</span>
                    </div>

                    <div className="mt-1 space-y-2 text-[0.95rem] leading-snug print:space-y-1.5 print:text-[0.85rem]">
                      {q.stem.split(/\n\s*\n/).map((para, i) => (
                        <p key={i}>{para}</p>
                      ))}
                    </div>

                    {q.imageUrl && (
                      <figure className="mt-2">
                        <img src={q.imageUrl} alt="" className="max-h-72 max-w-full border border-gray-300" />
                        {q.caption && (
                          <figcaption className="mt-1 text-[0.7rem] italic text-gray-600">
                            {q.caption}
                          </figcaption>
                        )}
                      </figure>
                    )}

                    <ul className="mt-2 space-y-1.5 print:space-y-1">
                      {q.choices.map((c) => {
                        const m = marker(c);
                        return (
                          <li key={c.id} className="text-sm leading-snug print:text-[0.8rem]">
                            <p className={c.isKey ? "font-semibold" : ""}>
                              {c.label}) {c.body}
                              {m && <span className="ml-2 text-xs font-semibold">[{m}]</span>}
                            </p>
                            {c.why && (
                              <p className="ml-5 mt-0.5 text-xs leading-snug text-gray-700 print:text-[0.68rem]">{c.why}</p>
                            )}
                          </li>
                        );
                      })}
                    </ul>

                    {q.explanation && (
                      <p className="mt-2 text-xs leading-snug print:text-[0.7rem]">
                        <span className="font-semibold">Explanation: </span>
                        {q.explanation}
                      </p>
                    )}
                    {q.objective && (
                      <p className="mt-1 text-xs leading-snug text-gray-700 print:text-[0.68rem]">
                        <span className="font-semibold">{q.objective.name}</span>
                        {q.objective.description ? ` — ${q.objective.description}` : ""}
                      </p>
                    )}
                    <hr className="mt-3 border-gray-300" />
                  </section>
                </td>
              </tr>
            ))}
          </tbody>

          {/* an empty spacer, repeated at the foot of every printed page */}
          <tfoot>
            <tr>
              <td>
                <div className="print-spacer" />
              </td>
            </tr>
          </tfoot>
        </table>

        {/* on screen: once, at the end */}
        <div className="screen-footer mt-6 border-t border-gray-400 pt-2 text-center text-xs tracking-widest text-gray-600">
          teterqbank
        </div>

        {/* on paper: fixed to the bottom of every page */}
        <div className="print-footer">teterqbank</div>
      </article>
    </>
  );
}
