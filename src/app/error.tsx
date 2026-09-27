"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="main" className="flex flex-1 flex-col items-center justify-center px-4 py-20 text-center">
      <h1 className="text-3xl font-extrabold">Something went wrong</h1>
      <p className="mt-2 max-w-md text-navy-700">An unexpected error occurred. Your data is safe — please try again.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Button variant="emerald" onClick={reset}>
          Try again
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Go home</Link>
        </Button>
      </div>
    </main>
  );
}
