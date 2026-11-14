export const ADMIN_HOME = "/admin/talleres";

/** Only relative, same-origin /admin paths (no login, no traversal, no control chars) are valid post-login targets. */
export function safeNextPath(raw: string | string[] | undefined | null): string {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (typeof v !== "string" || v === "") return ADMIN_HOME;
  if (!/^\/admin(?:[/?][^\s\\]*)?$/.test(v)) return ADMIN_HOME;
  if (/[\u0000-\u001f]|\/\/|\.\.|%2f|%5c|%2e/i.test(v)) return ADMIN_HOME;
  const path = v.split("?")[0];
  if (path === "/admin/login" || path.startsWith("/admin/login/")) return ADMIN_HOME;
  return v;
}

export function loginHref(next: string): string {
  return `/admin/login?next=${encodeURIComponent(next)}`;
}

export type AdminNavItem = { key: "talleres" | "scan" | "panel"; label: string; href: string; active: boolean };

export function adminNavItems(pathname: string, eventSlug: string | null | undefined): AdminNavItem[] {
  const q = eventSlug ? `?event=${encodeURIComponent(eventSlug)}` : "";
  return [
    { key: "talleres", label: "Talleres", href: "/admin/talleres", active: pathname === "/admin/talleres" || pathname.startsWith("/admin/talleres/") },
    { key: "scan", label: "Escanear", href: `/admin/scan${q}`, active: pathname === "/admin/scan" },
    { key: "panel", label: "Panel", href: `/admin${q}`, active: pathname === "/admin" },
  ];
}

export function sectionTitle(pathname: string): string {
  if (pathname === "/admin/talleres/nuevo") return "Nuevo taller";
  if (pathname.startsWith("/admin/talleres")) return "Mis talleres";
  if (pathname === "/admin/scan") return "Escanear";
  return "Panel";
}
