"use client";

import { useState } from "react";

/** Inline disclosure: no invented policy, just points to the organizer. */
export function Cancellations() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="cancel-info"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-11 flex-1 items-center justify-center rounded-[14px] border-[1.5px] border-line px-4 text-sm font-bold outline-none hover:bg-sunken focus-visible:ring-[3px] focus-visible:ring-mango"
      >
        Cancelaciones
      </button>
      {open && (
        <p id="cancel-info" className="basis-full text-sm text-muted-foreground">
          Escribe a la organizadora para cancelaciones o cambios.
        </p>
      )}
    </>
  );
}
