import type { ReactNode } from "react";

export function ContentPage({ title, intro, updated, children }: { title: string; intro?: ReactNode; updated?: string; children: ReactNode }) {
  return (
    <div className="container-page py-10">
      <article className="mx-auto max-w-3xl">
        <h1 className="text-3xl font-extrabold sm:text-4xl">{title}</h1>
        {intro ? <p className="mt-3 text-lg text-navy-700">{intro}</p> : null}
        {updated ? <p className="mt-2 text-sm text-muted-foreground">Last updated {updated}</p> : null}
        <div className="mt-8 space-y-8 leading-relaxed text-navy-800 [&_h2]:mb-2 [&_h2]:text-xl [&_h2]:font-bold [&_li]:mt-1 [&_ul]:list-disc [&_ul]:pl-5">{children}</div>
      </article>
    </div>
  );
}
