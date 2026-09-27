import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { getSiteSettings } from "@/server/services/settings";

const COLUMNS = [
  {
    title: "Explore",
    links: [
      { href: "/search?city=dhaka", label: "Rentals in Dhaka" },
      { href: "/search?city=chattogram", label: "Rentals in Chattogram" },
      { href: "/search?city=sylhet", label: "Rentals in Sylhet" },
      { href: "/search?type=hostel", label: "Hostels" },
      { href: "/search?type=commercial", label: "Commercial spaces" },
    ],
  },
  {
    title: "For owners",
    links: [
      { href: "/list-your-property", label: "List your property" },
      { href: "/dashboard/listings", label: "Owner dashboard" },
      { href: "/help#owners", label: "Listing guidelines" },
    ],
  },
  {
    title: "Help",
    links: [
      { href: "/help", label: "Help centre" },
      { href: "/help#safety", label: "Renting safely" },
      { href: "/contact", label: "Contact us" },
      { href: "/privacy", label: "Privacy policy" },
      { href: "/terms", label: "Terms of use" },
    ],
  },
];

export async function SiteFooter() {
  const settings = await getSiteSettings();
  return (
    <footer className="mt-auto bg-navy-950 text-navy-100">
      <div className="container-page grid gap-10 py-12 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <Logo inverted />
          <p className="mt-4 max-w-xs text-sm text-navy-200">
            A rental marketplace for homes, rooms, hostels and commercial spaces — starting in Bangladesh.
          </p>
          <ul className="mt-5 space-y-2 text-sm">
            <li className="flex items-center gap-2">
              <Mail className="size-4 text-emerald-400" aria-hidden="true" />
              <a href={`mailto:${settings.contactEmail}`} className="hover:text-white hover:underline">
                {settings.contactEmail}
              </a>
            </li>
            {settings.contactPhone ? (
              <li className="flex items-center gap-2">
                <Phone className="size-4 text-emerald-400" aria-hidden="true" />
                <a href={`tel:${settings.contactPhone.replace(/[^+\d]/g, "")}`} className="hover:text-white hover:underline">
                  {settings.contactPhone}
                </a>
              </li>
            ) : null}
            {settings.officeAddress ? (
              <li className="flex items-center gap-2">
                <MapPin className="size-4 text-emerald-400" aria-hidden="true" />
                {settings.officeAddress}
              </li>
            ) : null}
          </ul>
        </div>
        {COLUMNS.map((column) => (
          <nav key={column.title} aria-label={column.title}>
            <h2 className="text-sm font-semibold tracking-wide text-white uppercase">{column.title}</h2>
            <ul className="mt-4 space-y-2.5 text-sm">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-navy-200 hover:text-white hover:underline">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-navy-800">
        <div className="container-page flex flex-col gap-2 py-5 text-xs text-navy-300 sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} Dhaka Resident. Enquiries and viewing requests are not rental agreements.</p>
          <p>Prices in Bangladeshi Taka (৳ BDT).</p>
        </div>
      </div>
    </footer>
  );
}
