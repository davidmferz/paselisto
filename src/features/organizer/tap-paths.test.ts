import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = (p: string) => readFileSync(`src/${p}`, "utf8");

// Every transition of the organizer journey must be a tap: each pair is [file, text it must contain].
const TRANSITIONS: [string, string, string][] = [
  ["login -> Mis talleres", "components/admin/login-form.tsx", "router.replace(next)"],
  ["login (ya con sesion) -> Mis talleres", "app/admin/login/page.tsx", "redirectIfAuthed(next)"],
  ["Mis talleres -> Nuevo taller", "app/admin/(app)/talleres/page.tsx", 'href="/admin/talleres/nuevo"'],
  ["Mis talleres -> Ver panel", "features/events/components/event-card.tsx", "href={`/admin?event="],
  ["Mis talleres -> Escanear", "features/events/components/event-card.tsx", "href={`/admin/scan?event="],
  ["Nuevo taller -> volver", "features/events/components/new-event-flow.tsx", '<Link href="/admin/talleres"'],
  ["Publicado -> panel del taller", "features/events/components/new-event-flow.tsx", "Ver panel de este taller"],
  ["Publicado -> Mis talleres", "features/events/components/new-event-flow.tsx", "Ir a Mis talleres"],
  ["Panel -> Escanear (CTA)", "components/admin/orders-panel.tsx", "href={`/admin/scan?event="],
  ["Panel/Escaner -> Cambiar taller", "app/admin/(app)/scan/page.tsx", "Cambiar taller"],
  ["Resultado -> Escanear siguiente", "components/admin/scanner.tsx", "Escanear siguiente"],
  ["Resultado -> Panel", "components/admin/scanner.tsx", "href={`/admin?event="],
  ["Cualquier pantalla -> Salir", "components/admin/admin-shell.tsx", "<LogoutButton />"],
  ["Cualquier pantalla -> tabs", "components/admin/admin-shell.tsx", "adminNavItems(pathname, eventParam)"],
  ["Sin evento -> selector (scan)", "app/admin/(app)/scan/page.tsx", "<EventPicker"],
  ["Sin evento -> selector (panel)", "app/admin/(app)/page.tsx", "<EventPicker"],
];

describe("organizer tap paths", () => {
  it.each(TRANSITIONS)("%s", (_n, file, needle) => {
    expect(src(file)).toContain(needle);
  });
});
