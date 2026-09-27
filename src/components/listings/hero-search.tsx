import Form from "next/form";
import { CalendarDays, Home, Search, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";

const BUDGETS = [10000, 20000, 40000, 75000, 150000, 300000];

export function HeroSearch({ categories }: { categories: { slug: string; name: string }[] }) {
  return (
    <Form action="/search" className="rounded-2xl bg-white p-3 shadow-xl ring-1 ring-black/5 sm:p-4" role="search" aria-label="Search rentals">
      <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-[2fr_1fr_1fr_1fr_auto]">
        <label className="relative col-span-2 block md:col-span-1">
          <span className="sr-only">City, neighbourhood or keyword</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-navy-400" aria-hidden="true" />
          <input
            name="q"
            type="search"
            placeholder="City, area or keyword"
            maxLength={100}
            className="h-12 w-full rounded-xl border border-input bg-white pr-3 pl-10 text-base text-navy-900 placeholder:text-muted-foreground focus-visible:border-emerald-600 focus-visible:ring-3 focus-visible:ring-emerald-600/20 focus-visible:outline-none"
          />
        </label>
        <label className="relative block">
          <span className="sr-only">Property type</span>
          <Home className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-navy-400" aria-hidden="true" />
          <select
            name="type"
            defaultValue=""
            className="h-12 w-full appearance-none rounded-xl border border-input bg-white pr-3 pl-10 text-base text-navy-900 focus-visible:border-emerald-600 focus-visible:ring-3 focus-visible:ring-emerald-600/20 focus-visible:outline-none"
          >
            <option value="">Any type</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="relative block">
          <span className="sr-only">Maximum monthly budget</span>
          <Wallet className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-navy-400" aria-hidden="true" />
          <select
            name="maxRent"
            defaultValue=""
            className="h-12 w-full appearance-none rounded-xl border border-input bg-white pr-3 pl-10 text-base text-navy-900 focus-visible:border-emerald-600 focus-visible:ring-3 focus-visible:ring-emerald-600/20 focus-visible:outline-none"
          >
            <option value="">Any budget</option>
            {BUDGETS.map((b) => (
              <option key={b} value={b}>
                Up to ৳{b.toLocaleString("en-IN")}
              </option>
            ))}
          </select>
        </label>
        <label className="relative block">
          <span className="sr-only">Move-in date</span>
          <CalendarDays className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-navy-400" aria-hidden="true" />
          <input
            name="available"
            type="date"
            aria-describedby="move-in-hint"
            className="h-12 w-full rounded-xl border border-input bg-white pr-3 pl-10 text-base text-navy-900 focus-visible:border-emerald-600 focus-visible:ring-3 focus-visible:ring-emerald-600/20 focus-visible:outline-none"
          />
        </label>
        <Button type="submit" size="lg" variant="emerald" className="h-12 rounded-xl">
          <Search data-icon="inline-start" />
          Search
        </Button>
      </div>
      <p id="move-in-hint" className="mt-2 hidden px-1 text-xs text-muted-foreground sm:block">
        Move-in date shows places available on or before that day.
      </p>
    </Form>
  );
}
