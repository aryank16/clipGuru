import { CalendarClock, Clapperboard, Settings, type LucideIcon } from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

/** Main sections of the signed-in app, in sidebar order. */
export const NAV: NavItem[] = [
  { href: "/videos", label: "My videos", icon: Clapperboard },
  { href: "/scheduled", label: "Scheduled", icon: CalendarClock },
  { href: "/settings", label: "Settings", icon: Settings },
];

/** True when `pathname` is the section itself or a page inside it. */
export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
