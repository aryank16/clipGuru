import type { ReactNode } from "react";
import { Card } from "./card";

/** Centered card for a page with nothing in it yet. */
export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Card className="mx-auto flex w-full max-w-2xl flex-col items-center gap-5 px-6 py-14 text-center sm:px-12 sm:py-20">
      <div className="flex size-14 items-center justify-center rounded-2xl border border-dashed border-taupe/40 text-taupe">
        {icon}
      </div>
      <div className="flex flex-col gap-2">
        <h2 className="font-display text-2xl font-black tracking-tight sm:text-3xl">{title}</h2>
        <p className="max-w-md text-taupe">{children}</p>
      </div>
      {action}
    </Card>
  );
}
