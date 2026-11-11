import Link from "next/link";

export type Bank = {
  slug: string;
  title: string;
  description: string | null;
  question_count: number | string;
  hidden?: boolean; // only ever set for admins
  open?: { answered: number; total: number }; // this student has a session they can resume
};

// the small "In progress" pill used on bank rows
export function InProgressPill() {
  return (
    <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-brand-100 px-2 py-0.5 align-middle text-xs font-medium text-brand-800 dark:bg-brand-900 dark:text-brand-100">
      <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
      In progress
    </span>
  );
}

// One compact row per bank: the title on the left, the question count on the right.
// `label` replaces the title on screen (e.g. the session name inside a Case folder).
export function BankRow({ qb, label }: { qb: Bank; label?: string }) {
  return (
    <Link
      href={`/qbank/${qb.slug}`}
      className="flex items-baseline justify-between gap-4 px-4 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-900"
    >
      <span className="font-medium">
        {label ?? qb.title}
        {qb.open && <InProgressPill />}
        {qb.hidden && (
          <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 align-middle text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-200">
            Hidden from students
          </span>
        )}
      </span>
      <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">
        {qb.open ? `${qb.open.answered} of ${qb.open.total} answered` : `${qb.question_count} questions`}
      </span>
    </Link>
  );
}

// a bordered list of bank rows
export default function BankList({
  banks,
  label,
}: {
  banks: Bank[];
  label?: (qb: Bank) => string | undefined;
}) {
  if (!banks.length) return null;
  return (
    <div className="divide-y divide-gray-200 overflow-hidden rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
      {banks.map((qb) => (
        <BankRow key={qb.slug} qb={qb} label={label?.(qb)} />
      ))}
    </div>
  );
}
