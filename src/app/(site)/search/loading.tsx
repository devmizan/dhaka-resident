import { Skeleton } from "@/components/ui/skeleton";

export default function SearchLoading() {
  return (
    <div className="container-page py-6 sm:py-8" aria-busy="true" aria-label="Loading results">
      <div className="grid gap-8 lg:grid-cols-[300px_1fr]">
        <Skeleton className="hidden h-[70vh] rounded-2xl lg:block" />
        <div>
          <Skeleton className="h-9 w-72" />
          <Skeleton className="mt-2 h-5 w-40" />
          <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="overflow-hidden rounded-2xl border bg-white">
                <Skeleton className="aspect-[4/3] rounded-none" />
                <div className="space-y-2 p-4">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-6 w-32" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
