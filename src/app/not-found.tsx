import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="main" className="flex flex-1 flex-col items-center justify-center px-4 py-20 text-center">
      <Logo />
      <p className="mt-10 text-sm font-semibold tracking-wide text-emerald-700 uppercase">404</p>
      <h1 className="mt-2 text-3xl font-extrabold">We couldn&apos;t find that page</h1>
      <p className="mt-2 max-w-md text-navy-700">The listing may have been rented, paused or removed, or the link may be wrong.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button asChild variant="emerald">
          <Link href="/search">Browse rentals</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Go home</Link>
        </Button>
      </div>
    </main>
  );
}
