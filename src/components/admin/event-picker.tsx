import Link from "next/link";
import { ChevronRight } from "lucide-react";

export type PickerEvent = { id: string; slug: string; name: string };

/** Big tap targets, one per event. `base` is the destination (e.g. "/admin/scan"); the slug is appended. */
export function EventPicker({ title, events, base }: { title: string; events: PickerEvent[]; base: string }) {
  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-h1 font-display">{title}</h1>
      {events.length === 0 ? (
        <div className="flex flex-col gap-3 rounded-[24px] border border-dashed border-line-strong bg-surface p-6 text-center">
          <p className="text-base text-muted-foreground">Todavía no hay talleres.</p>
          <Link href="/admin/talleres" className="inline-flex h-13 min-h-12 items-center justify-center rounded-[14px] bg-ink px-5 font-bold text-on-ink">
            Ir a Mis talleres
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {events.map((e) => (
            <li key={e.id}>
              <Link
                href={`${base}?event=${encodeURIComponent(e.slug)}`}
                className="flex min-h-16 items-center justify-between gap-3 rounded-[18px] border-[1.5px] border-line bg-surface px-5 py-3 text-left text-lg font-bold outline-none hover:bg-sunken focus-visible:ring-[3px] focus-visible:ring-mango"
              >
                <span className="min-w-0 break-words">{e.name}</span>
                <ChevronRight className="size-5 shrink-0" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
