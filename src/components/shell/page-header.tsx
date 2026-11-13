import type { ReactNode } from "react";

/** Big uppercase page title with an optional mono count pill and actions on the right. */
export function PageHeader({ title, count, actions }: { title: string; count?: string; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-hairline pb-6">
      <div className="flex items-center gap-4">
        <h1 className="font-display text-3xl font-black uppercase leading-none tracking-tight sm:text-4xl">
          {title}
        </h1>
        {count ? (
          <span className="rounded-full border border-hairline px-3 py-1 font-mono text-xs uppercase text-taupe">
            {count}
          </span>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-3">{actions}</div> : null}
    </header>
  );
}
