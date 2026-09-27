import type { ReactNode } from "react";

export function AuthCard({ title, description, children, footer, wide = false }: { title: string; description?: ReactNode; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  return (
    <div className="flex flex-1 items-start justify-center bg-navy-50/60 px-4 py-10 sm:py-14">
      <div className={`w-full ${wide ? "max-w-xl" : "max-w-md"}`}>
        <div className="rounded-2xl border bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-bold">{title}</h1>
          {description ? <div className="mt-1.5 text-sm text-muted-foreground">{description}</div> : null}
          <div className="mt-6">{children}</div>
        </div>
        {footer ? <div className="mt-5 text-center text-sm text-navy-700">{footer}</div> : null}
      </div>
    </div>
  );
}
