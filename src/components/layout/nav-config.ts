import type { Role } from "@/generated/prisma/enums";

export const PUBLIC_NAV = [
  { href: "/search", label: "Find a rental" },
  { href: "/search?type=apartment", label: "Apartments" },
  { href: "/search?type=hostel", label: "Hostels" },
  { href: "/search?type=commercial", label: "Commercial" },
  { href: "/list-your-property", label: "For owners" },
];

export type AccountLink = { href: string; label: string; icon: string };

export function accountLinks(role: Role): AccountLink[] {
  if (role === "ADMIN") {
    return [
      { href: "/admin", label: "Admin overview", icon: "layout-dashboard" },
      { href: "/admin/listings?status=PENDING_REVIEW", label: "Listing approvals", icon: "clipboard-check" },
      { href: "/admin/users", label: "Users & roles", icon: "users" },
      { href: "/admin/reports", label: "Reports", icon: "flag" },
      { href: "/admin/catalogue", label: "Locations & catalogue", icon: "map" },
      { href: "/admin/activity", label: "Activity log", icon: "history" },
      { href: "/admin/settings", label: "Website settings", icon: "settings" },
      { href: "/dashboard/notifications", label: "Notifications", icon: "bell" },
      { href: "/dashboard/account", label: "Account", icon: "user" },
    ];
  }
  if (role === "OWNER") {
    return [
      { href: "/dashboard", label: "Overview", icon: "layout-dashboard" },
      { href: "/dashboard/listings", label: "My listings", icon: "building-2" },
      { href: "/dashboard/messages", label: "Enquiries & messages", icon: "message-square" },
      { href: "/dashboard/viewings", label: "Viewings", icon: "calendar-clock" },
      { href: "/dashboard/notifications", label: "Notifications", icon: "bell" },
      { href: "/dashboard/account", label: "Account", icon: "user" },
    ];
  }
  return [
    { href: "/dashboard", label: "Overview", icon: "layout-dashboard" },
    { href: "/dashboard/saved", label: "Saved properties", icon: "heart" },
    { href: "/dashboard/messages", label: "Enquiries & messages", icon: "message-square" },
    { href: "/dashboard/viewings", label: "Viewing requests", icon: "calendar-clock" },
    { href: "/dashboard/notifications", label: "Notifications", icon: "bell" },
    { href: "/dashboard/account", label: "Account", icon: "user" },
  ];
}
