import {
  Bell,
  Building2,
  CalendarClock,
  ClipboardCheck,
  Flag,
  Heart,
  History,
  LayoutDashboard,
  Map,
  MessageSquare,
  Settings,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";

const NAV_ICONS: Record<string, LucideIcon> = {
  bell: Bell,
  "building-2": Building2,
  "calendar-clock": CalendarClock,
  "clipboard-check": ClipboardCheck,
  flag: Flag,
  heart: Heart,
  history: History,
  "layout-dashboard": LayoutDashboard,
  map: Map,
  "message-square": MessageSquare,
  settings: Settings,
  user: User,
  users: Users,
};

export function NavIcon({ name, className }: { name: string; className?: string }) {
  const Icon = NAV_ICONS[name] ?? LayoutDashboard;
  return <Icon className={className} aria-hidden="true" />;
}
